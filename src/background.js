const { User, Spelling } = require('./classes')
const { createMenuItems, loadDictionariesAndPrefs, prepareLanguages, getSettingsFromArray } = require('./helpers')
const { cleanWord } = require('./text-methods')

// defaults are set when background script first loads
let customSettings = { disableNativeSpellcheck: false }
let customHighlightColor = { color: '#0098ff' }

let customWords, sidebarOpen, user

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

// get color from browser storage
async function getCustomColor () {
  const storedColor = await browser.storage.sync.get('color')
  if (storedColor.color) {
    customHighlightColor = storedColor
  }
}

// get user specified extension settings from browser storage
async function getCustomSettings () {
  const storedSettings = await browser.storage.sync.get('settings')
  if (Array.isArray(storedSettings.settings)) {
    customSettings = getSettingsFromArray(storedSettings.settings)
  }
}

// saves user specified extension settings (i.e. from popup) to browser storage
async function saveColor (color) {
  const error = await browser.storage.sync.set({ color })

  if (error) {
    console.warn(`MultiDict: Saving settings failed with error: ${error}`)
  } else {
    customHighlightColor = color
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

// respond to the sender with an object containing message content and type
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

// checks content for spelling errors and returns a new Spelling instance
function getSpelling (message) {
  const lang = user.getPreferredLanguage(message.detectedLanguage)
  return new Spelling(user.spellers[lang], message.content)
}

// api that handles performing all actions - background functions should only ever be called by api
// api always cleans the text before adding/removing custom words
function api (message, sender) {
  switch (message.type) {
    case 'add':
      addCustomWord(cleanWord(message.word))
        .then(() => respond(sender, { type: 'add' }, 'refresh'))
      break
    case 'remove':
      removeCustomWord(cleanWord(message.word))
        .then(() => respond(sender, { type: 'remove' }, 'refresh'))
      break
    case 'getSpelling':
      respond(sender, getSpelling(message), 'highlight')
      break
    case 'getCustomHighlightColor':
      getCustomColor()
        .then(() => respond(sender, customHighlightColor, 'gotCustomColor'))
      break
    case 'getCustomWords':
      respond(sender, customWords, 'gotCustomWords')
      break
    case 'getCustomSettings':
      getCustomSettings()
        .then(() => respond(sender, customSettings, 'gotCustomSettings'))
      break
    case 'sidebar':
      sidebarOpen = message.isOpen
      break
    case 'previewColor':
      respond(sender, { type: 'preview', color: message.color }, 'refresh')
      break
    case 'saveColor':
      saveColor(message.color)
        .then(() => respond(sender, { type: 'color', color: customHighlightColor }, 'refresh'))
      break
    case 'saveSettings':
      saveSettings(message.settings)
        .then(() => respond(sender, customSettings, 'savedSettings'))
      break
    default:
      console.warn(`MultDict: unrecognized message type ${message.type}. Aborting.`)
  }
}

// listens to all incoming messages from the popup/action menu and handle popup closing
function sidebarListener (sidebarPort) {
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

// load dictionaries, create langauges from browser acceptLanguages, and instantiate user
async function main () {
  const languages = prepareLanguages(await browser.i18n.getAcceptLanguages())
  const dictionariesAndPrefs = await loadDictionariesAndPrefs(languages)

  // TODO: only get custom words when needed
  customWords = await browser.storage.sync.get('personal')
  customWords = Array.isArray(customWords.personal) ? customWords.personal : []
  user = new User(dictionariesAndPrefs.dicts, dictionariesAndPrefs.prefs, languages, [...customWords])

  createMenuItems()

  console.log('langs', user.langs)
  console.log('prefs', user.prefs)
  console.log('words', user.ownWords)
}

browser.commands.onCommand.addListener(commandAndMenuListener)
browser.menus.onClicked.addListener(commandAndMenuListener)
browser.runtime.onMessage.addListener(api)
browser.runtime.onConnect.addListener(sidebarListener)
browser.browserAction.onClicked.addListener(() => {
  sidebarOpen
    ? browser.sidebarAction.close()
    : browser.sidebarAction.open()
  sidebarOpen = !sidebarOpen
})

main()

// Goal: enable multiple laguages to be used when spell checking by detecting content language
//
// Note: do not use asnyc functions for any listener, as per the MDN docs, use normal functions
// and Promises for delaying logic/responses (async listeners consume all messages and prevent
// other listeners of the same event gettingt them).
