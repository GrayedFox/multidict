const { User, Spelling } = require('./classes.js')
const {
  cleanWord, createMenuItems, loadDictionariesAndPrefs, prepareLanguages, updateSettingsObject
} = require('./helpers.js')

const defaultSettings = ['disableNativeSpellcheck-false']

let customSettings, customWords, user

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
async function getCustomSettings () {
  customSettings = await browser.storage.sync.get('settings')
  customSettings = Array.isArray(customSettings.settings)
    ? updateSettingsObject(customSettings.settings)
    : updateSettingsObject(defaultSettings)
}

// saves user specified extension settings (i.e. from popup) to browser storage
async function saveSettings (message) {
  const error = await browser.storage.sync.set({ settings: message.settings })

  if (error) {
    console.warn(`MultiDict: Saving settings failed with error: ${error}`)
  } else {
    customSettings = updateSettingsObject(message.settings)
  }
}

// respond to the sender with an object containing message content and type
function respond (sender, content, type) {
  console.log('type', type)
  console.log('content', content)
  console.log('sender', sender)
  if (sender.tab) {
    browser.tabs.sendMessage(sender.tab.id, { type, content })
  } else if (sender.name === 'popup') {
    sender.postMessage({ type, content })
  } else {
    console.warn('MultiDict: unrecognized sender structure. Cannot respond to sender:', sender)
  }
}

// checks content for spelling errors and returns a new Spelling instance
function spellCheck (message) {
  const lang = user.getPreferredLanguage(message.detectedLanguage)
  return new Spelling(user.spellers[lang], message.content)
}

// api that handles performing all actions - background functions should only ever be called by api
// api always cleans the text before adding/removing custom words
function api (message, sender) {
  switch (message.type) {
    case 'add':
      addCustomWord(cleanWord(message.word))
        .then(() => respond(sender, null, 'refresh'))
      break
    case 'remove':
      removeCustomWord(cleanWord(message.word))
        .then(() => respond(sender, null, 'refresh'))
      break
    case 'spellCheck':
      respond(sender, spellCheck(message), 'highlight')
      break
    case 'getCustomWords':
      respond(sender, customWords, 'getCustomWords')
      break
    case 'getCustomSettings':
      getCustomSettings()
        .then(() => respond(sender, customSettings, 'getCustomSettings'))
      break
    case 'saveSettings':
      saveSettings(message)
      break
    default:
      console.warn(`MultDict: unrecognized message type ${message.type}. Aborting.`)
  }
}

// listens to all incoming messages from the popup/action menu and handle popup closing
function popupListener (popupPort) {
  if (!popupPort.onMessage.hasListener(api)) {
    popupPort.onMessage.addListener(api)
    popupPort.onDisconnect.addListener(() => {
      // remove listener and cleanup popupPort when popup closed
      popupPort.onMessage.removeListener(api)
      popupPort = null
    })
  }
}

// listens to all incoming commands (keyboard shortcuts) and context menu messages
async function commandAndMenuListener (info, tab) {
  const command = info.menuItemId || info
  // tab parameter is blank when shortcut keys are used to add or remove a word
  if (!tab) {
    tab = await getCurrentTab
  }

  // when using shortcuts or context menu, we add/remove words via the content script
  // this enables the user to define a keyboard shortcut to trigger add/remove which will smartly
  // detect the word based on selection or cursor position on the currently active tab
  if (tab && command) {
    respond({ tab }, { word: info.selectionText }, command)
  } else {
    console.warn(`MultiDict: Command ${command} failed. Tab info:`, tab)
  }
}

// load dictionaries, create langauges from browser acceptLanguages, and instantiate user
async function main () {
  const languages = prepareLanguages(await browser.i18n.getAcceptLanguages())
  const dictionariesAndPrefs = await loadDictionariesAndPrefs(languages)

  customWords = await browser.storage.sync.get('personal')
  customWords = Array.isArray(customWords.personal) ? customWords.personal : []
  user = new User(dictionariesAndPrefs.dicts, dictionariesAndPrefs.prefs, languages, [...customWords])

  createMenuItems()

  console.log('langs', user.langs)
  console.log('prefs', user.prefs)
  console.log('words', user.ownWords)
  console.log('settings', customSettings)
}

browser.commands.onCommand.addListener(commandAndMenuListener)
browser.menus.onClicked.addListener(commandAndMenuListener)
browser.runtime.onMessage.addListener(api)
browser.runtime.onConnect.addListener(popupListener)

main()

// browser.tabs.onCreated.addListener(connectToActiveTab)

// Goal: enable multiple laguages to be used when spell checking by detecting content language
//
// MVP: spell check using dictionaries, detect language of each field, highlight misspelled words,
// show suggestions, persistent personal dictionary
