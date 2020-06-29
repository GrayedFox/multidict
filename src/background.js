const { User, Spelling } = require('./classes')
const { createMenuItems, loadDictionariesAndPrefs, prepareLanguages, getSettingsFromArray } = require('./helpers')
const { cleanWord } = require('./text-methods')

// defaults set when background script first loads in case no values exist in storage yet
let customSettings = { disableNativeSpellcheck: false }
let customHighlightColor = { color: '#FF0000' }
const maxSuggestions = { maxSuggestions: 6 }

let customWords, sidebarOpen, sidebarPort, user

// load dictionaries, create langauges from browser acceptLanguages, and instantiate user
async function init () {
  browser.commands.onCommand.addListener(commandAndMenuListener)
  browser.menus.onClicked.addListener(commandAndMenuListener)
  browser.runtime.onMessage.addListener(api)
  browser.runtime.onConnect.addListener(sidebarListener)
  browser.browserAction.onClicked.addListener(popupListener)
  // FIXME: sidebar open/close bugged if multiple windows open and showing Multidict sidebar

  const languages = prepareLanguages(await browser.i18n.getAcceptLanguages())
  const dictionariesAndPrefs = await loadDictionariesAndPrefs(languages)

  // TODO: only get custom words when needed
  customWords = await browser.storage.sync.get('personal')
  customWords = Array.isArray(customWords.personal) ? customWords.personal : []
  user = new User(dictionariesAndPrefs.dicts, dictionariesAndPrefs.prefs, languages, [...customWords])

  createMenuItems()
}

// api that handles performing all actions - background functions should only ever be called by api
// api always cleans the text before adding/removing custom words
function api (message, sender) {
  switch (message.type) {
    case 'add':
      addCustomWord(cleanWord(message.word)).then(() => {
        respond(sender, { type: 'recheck' }, 'refresh')
        if (sidebarPort) sidebarPort.postMessage({ type: 'addWord', content: customWords })
      })
      break
    case 'remove':
      removeCustomWord(cleanWord(message.word)).then(() => {
        respond(sender, { type: 'recheck' }, 'refresh')
        if (sidebarPort) sidebarPort.postMessage({ type: 'removeWord', content: customWords })
      })
      break
    case 'getSpelling':
      respond(sender, getSpelling(message), 'highlight')
      break
    case 'getColor':
      getColor()
        .then(() => respond(sender, customHighlightColor, 'gotCustomColor'))
      break
    case 'getMaxSuggestions':
      getMaxSuggestions()
        .then(() => respond(sender, maxSuggestions, 'gotMaxSuggestions'))
      break
    case 'saveMaxSuggestions':
      saveMaxSuggestions(message.limit)
        .then(() => respond(sender, { type: 'suggestions', ...maxSuggestions }, 'refresh'))
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
    case 'getCustomWords':
      respond(sender, customWords, 'gotCustomWords')
      break
    case 'sidebar':
      sidebarOpen = message.isOpen
      respond(sender, { type: 'render' }, 'refresh')
      break
    case 'saveSettings':
      saveSettings(message.settings)
        .then(() => respond(sender, customSettings, 'savedSettings'))
      break
    default:
      console.warn(`MultDict: unrecognized message type ${message.type}. Aborting.`)
  }
}

// respond to the sender or all tabs with an object containing message content and type
function respond (sender, content, type) {
  console.log('type', type)
  console.log('content', content)
  console.log('sender', sender)
  if (sender.tab) {
    browser.tabs.sendMessage(sender.tab.id, { type, content })
  } else if (type === 'refresh') {
    browser.tabs.query({}).then(tabs => {
      tabs.forEach(tab => { browser.tabs.sendMessage(tab.id, { type, content }) })
    })
  } else if (sender.name === 'popup') {
    sender.postMessage({ type, content })
  } else {
    console.warn('MultiDict: unrecognized sender structure. Cannot respond to sender:', sender)
  }
}

// saves a word in browser storage and calls user.addWord
async function addCustomWord (word) {
  if (!word || customWords.includes(word)) {
    return
  }

  const error = await browser.storage.sync.set({ personal: [...customWords, word] })

  if (error) {
    console.warn(`MultiDict: Adding to personal dictionary failed with error: ${error}`)
  } else {
    customWords.push(word)
    user.addWord(word)
  }
}

// removes a word from browser storage and calls user.removeWord
async function removeCustomWord (word) {
  if (!word || !customWords.includes(word)) {
    return
  }

  const error = await browser.storage.sync.set({ personal: [...customWords].remove(word) })

  if (error) {
    console.warn(`MultiDict: Removing from personal dictionary failed with error: ${error}`)
  } else {
    customWords.remove(word)
    user.removeWord(word)
  }
}

// get current active tab
async function getCurrentTab () {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true })
  return tabs[0]
}

// get user specified extension settings from browser storage
async function getSettings () {
  const storedSettings = await browser.storage.sync.get('settings')
  if (Array.isArray(storedSettings.settings)) {
    customSettings = getSettingsFromArray(storedSettings.settings)
  }
}

// saves user specified extension settings (i.e. from popup) to browser storage
async function saveSettings (settings) {
  const error = await browser.storage.sync.set({ settings })

  if (error) {
    console.warn(`MultiDict: Saving settings failed with error: ${error}`)
  } else {
    customSettings = getSettingsFromArray(settings)
  }
}

// gets color from browser storage
async function getColor () {
  const storedColor = await browser.storage.sync.get('color')
  if (storedColor.color) {
    customHighlightColor = storedColor
  }
}

// saves color to browser storage
async function saveColor (color) {
  const error = await browser.storage.sync.set({ color })

  if (error) {
    console.warn(`MultiDict: Saving color failed with error: ${error}`)
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
    console.warn(`MultiDict: Saving suggestion limit failed with error: ${error}`)
  } else {
    maxSuggestions.maxSuggestions = limit
  }
}

// checks content for spelling errors and returns a new Spelling instance
function getSpelling (message) {
  const lang = user.getPreferredLanguage(message.detectedLanguage)
  return new Spelling(user.spellers[lang], message.content)
}

// listens to all incoming messages from the popup/action menu and handle popup closing
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
  sidebarOpen
    ? browser.sidebarAction.close()
    : browser.sidebarAction.open()
  sidebarOpen = !sidebarOpen
}

init()

// Goal: enable multiple laguages to be used when spell checking by detecting content language
//
// Note: do not use asnyc functions for any listener, as per the MDN docs, use normal functions
// and Promises for delaying logic/responses (async listeners consume all messages and prevent
// other listeners of the same event gettingt them).
