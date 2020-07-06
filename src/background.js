const { CustomWordList, User, Spelling } = require('./classes')
const { createMenuItems, getDefaultLanguages, loadDictionariesAndPrefs, prepareLanguages } = require('./helpers')
const { cleanWord } = require('./text-methods')

const DEBUG = false
const LANGUAGES = ['de-de', 'en-au', 'en-en', 'en-gb', 'es-es', 'fr-fr', 'pl-pl', 'ro-ro', 'ru-ru']

// default values for when background script first loads in case no values yet exist in storage
const maxSuggestions = { maxSuggestions: 6 }
const customHighlightColor = { color: '#FF0000' }
let customSettings = ['disableNativeSpellcheck']
let customWords = new CustomWordList({ Multidict: [...LANGUAGES] })

let customLanguages, sidebarOpen, sidebarPort, user

// load dictionaries, create langauges from browser acceptLanguages, and instantiate user
async function init () {
  browser.commands.onCommand.addListener(commandAndMenuListener)
  browser.menus.onClicked.addListener(commandAndMenuListener)
  browser.runtime.onMessage.addListener(api)
  browser.runtime.onConnect.addListener(sidebarListener)
  browser.browserAction.onClicked.addListener(popupListener)

  // browser.storage.sync.clear()

  await getLanguages()
  await getCustomWords()

  if (!Array.isArray(customLanguages)) {
    const languages = await getDefaultLanguages()
    customLanguages = prepareLanguages(languages) // remove any duplicates and format languages
    saveLanguages(customLanguages)
  }

  const dictionariesAndPrefs = await loadDictionariesAndPrefs(customLanguages)
  user = new User(dictionariesAndPrefs.dicts, dictionariesAndPrefs.prefs, customLanguages, customWords.wordList)

  createMenuItems()
}

// api that handles performing all actions - background functions should only ever be called by api
// api always cleans the text before adding/removing custom words
// api will push relevant settings/changes to content scripts to trigger a recheck/rehighlight
function api (message, sender) {
  switch (message.type) {
    case 'addCustomWord':
      addCustomWord(cleanWord(message.word)).then(() => {
        respond(sender, { type: 'recheck' }, 'refresh')
        if (sidebarPort) sidebarPort.postMessage({ type: 'addedWord', content: customWords.words })
      })
      break
    case 'removeCustomWord':
      removeCustomWord(cleanWord(message.word)).then(() => {
        respond(sender, { type: 'recheck' }, 'refresh')
        if (sidebarPort) sidebarPort.postMessage({ type: 'removedWord', content: customWords.words })
      })
      break
    case 'getCustomWords':
      respond(sender, customWords.words, 'gotCustomWords')
      break
    case 'getLanguages':
      getLanguages()
        .then(() => respond(sender, customLanguages, 'gotLanguages'))
      break
    case 'saveLanguages':
      saveLanguages(message.languages)
      break
    case 'getMaxSuggestions':
      getMaxSuggestions()
        .then(() => respond(sender, maxSuggestions, 'gotMaxSuggestions'))
      break
    case 'saveMaxSuggestions':
      saveMaxSuggestions(message.limit)
        .then(() => respond(sender, { type: 'suggestions', ...maxSuggestions }, 'refresh'))
      break
    case 'getColor':
      getColor()
        .then(() => respond(sender, customHighlightColor, 'gotCustomColor'))
      break
    case 'previewColor':
      respond(sender, { type: 'preview', color: message.color }, 'refresh')
      break
    case 'saveColor':
      saveColor(message.color)
        .then(() => respond(sender, { type: 'color', ...customHighlightColor }, 'refresh'))
      break
    case 'getSettings':
      getSettings()
        .then(() => respond(sender, customSettings, 'gotCustomSettings'))
      break
    case 'saveSettings':
      saveSettings(message.settings)
        .then(() => respond(sender, { type: 'settings', customSettings }, 'refresh'))
      break
    case 'getSpelling':
      respond(sender, getSpelling(message), 'highlight')
      break
    case 'sidebar':
      sidebarOpen = message.isOpen
      respond(sender, { type: 'render' }, 'refresh')
      break
    default:
      console.warn(`MultDict: unrecognized message type ${message.type}. Aborting.`)
  }
}

// respond to the sender or all tabs with an object containing message content and type
function respond (sender, content, type) {
  if (DEBUG) {
    console.log('type', type)
    console.log('content', content)
    console.log('sender', sender)
  }
  if (sender.tab) {
    browser.tabs.sendMessage(sender.tab.id, { type, content })
  } else if (type === 'refresh') {
    browser.tabs.query({}).then(tabs => tabs.forEach(tab => {
      // don't attempt to send messages to settings pages
      if (!tab.url.match(/^about:/)) {
        browser.tabs.sendMessage(tab.id, { type, content }).catch(errorHandler)
      }
    }))
  } else if (sender.name === 'popup') {
    sender.postMessage({ type, content })
  } else {
    console.warn('Multidict: unrecognized sender structure. Cannot respond to sender:', sender)
  }
}

// listens to all incoming messages from the popup/action menu and handle sidebar closing
function sidebarListener (port) {
  sidebarPort = port
  if (!sidebarPort.onMessage.hasListener(api)) {
    sidebarPort.onMessage.addListener(api)
    sidebarPort.onDisconnect.addListener(() => {
      // remove listener and cleanup sidebarPort when popup closed
      sidebarPort.onMessage.removeListener(api)
      sidebarPort = null
    })
  }
}

// listens to all incoming commands (keyboard shortcuts) and context menu messages
function commandAndMenuListener (info, tab) {
  const command = info.menuItemId || info
  // tab parameter is undefined if listener triggered by shortcut keys
  if (!tab && command) {
    getCurrentTab().then(tab => respond({ tab }, { word: info.selectionText }, command))
  }

  // when using shortcuts or context menu, we add/remove words via the content script
  // this enables us to use info.selectedText when it is defined (context menu)
  // or detect the caret position of the currently active tab when it's not (keyboard shortcut)
  if (tab && command) {
    respond({ tab }, { word: info.selectionText }, command)
  }
}

// listen to the browser action icon being clicked and open or close the sidebar
function popupListener () {
  // FIXME: sidebar open/close bugged if multiple windows open and showing Multidict sidebar
  sidebarOpen
    ? browser.sidebarAction.close()
    : browser.sidebarAction.open()
  sidebarOpen = !sidebarOpen
}

// saves a word in browser storage and calls user.addWord
async function addCustomWord (word) {
  if (!word || customWords.words.includes(word)) {
    return
  }

  customWords.add(word, customLanguages)
  const error = await browser.storage.sync.set({ personal: customWords.wordList })

  if (error) {
    console.warn(`Multidict: Adding to personal dictionary failed with error: ${error}`)
    customWords.remove(word)
  } else {
    user.addWord(word)
  }
}

// removes a word from browser storage and calls user.removeWord
async function removeCustomWord (word) {
  if (!word || !customWords.words.includes(word)) {
    return
  }

  customWords.remove(word)
  const error = await browser.storage.sync.set({ personal: customWords.wordList })

  if (error) {
    console.warn(`Multidict: Removing from personal dictionary failed with error: ${error}`)
    customWords.add(word, customLanguages)
  } else {
    user.removeWord(word)
  }
}

// get custom words from storage, used during init
async function getCustomWords () {
  const storedWords = await browser.storage.sync.get('personal')

  if (typeof storedWords.personal === 'object' || Array.isArray(storedWords.personal)) {
    customWords = new CustomWordList(storedWords.personal)
  }
}

// get user languages from browser storage
async function getLanguages () {
  const storedLanguages = await browser.storage.sync.get('languages')
  if (Array.isArray(storedLanguages.languages)) {
    customLanguages = storedLanguages.languages
  }
}

// saves an array of user specified languages to browser storage
async function saveLanguages (languages) {
  const error = await browser.storage.sync.set({ languages })

  if (error) {
    console.warn(`Multidict: Saving languages failed with error: ${error}`)
  } else {
    customLanguages = languages
  }
}

// get user specified extension settings from browser storage
async function getSettings () {
  const storedSettings = await browser.storage.sync.get('settings')
  if (Array.isArray(storedSettings.settings)) {
    customSettings = storedSettings.settings
  }
}

// saves user specified extension settings (i.e. from popup) to browser storage
async function saveSettings (settings) {
  const error = await browser.storage.sync.set({ settings })

  if (error) {
    console.warn(`Multidict: Saving settings failed with error: ${error}`)
  } else {
    customSettings = settings
  }
}

// gets color from browser storage
async function getColor () {
  const storedColor = await browser.storage.sync.get('color')
  if (storedColor.color) {
    customHighlightColor.color = storedColor.color
  }
}

// saves color to browser storage
async function saveColor (color) {
  const error = await browser.storage.sync.set({ color })

  if (error) {
    console.warn(`Multidict: Saving color failed with error: ${error}`)
  } else {
    customHighlightColor.color = color
  }
}

// gets max suggestions from browser storage
async function getMaxSuggestions () {
  const storedLimit = await browser.storage.sync.get('maxSuggestions')

  if (storedLimit.maxSuggestions) {
    maxSuggestions.maxSuggestions = parseInt(storedLimit.maxSuggestions, 10)
  }
}

// saves max suggestions to browser storage
async function saveMaxSuggestions (limit) {
  const error = await browser.storage.sync.set({ maxSuggestions: limit })

  if (error) {
    console.warn(`Multidict: Saving suggestion limit failed with error: ${error}`)
  } else {
    maxSuggestions.maxSuggestions = limit
  }
}

// checks content for spelling errors and returns a new Spelling instance
function getSpelling (message) {
  const lang = user.getPreferredLanguage(message.detectedLanguage)
  return new Spelling(user.spellers[lang], message.content)
}

// get current active tab
async function getCurrentTab () {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true })
  return tabs[0]
}

// handling of the erroring
function errorHandler (error) {
  console.error(error)
}

init()

// Vision: enable multiple laguages to be used when spell checking by detecting content language
//
// Architectural/Design Decisions
// - do not use asnyc functions for any listener, as per the MDN docs, use normal functions
//   and Promises for delaying logic/responses (async listeners consume all messages and prevent
//   other listeners of the same event gettingt them).
//
// - the CustomWordList and User classes should remain seperate. The reason is a User can change
//   their list of languages for spell checking at any time, and we don't actually need to know the
//   language a custom word is misspelt in as it is saved to browser storage (although we store it
//   just in case). At runtime however, the User is instantiatied and at this time we will check the
//   currently used langauges and only add custom words to dictionaries that are missing this word.
//   This architecture also fixes https://github.com/GrayedFox/multidict/issues/39
