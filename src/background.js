const { User, Spelling } = require('./classes.js')
const {
  cleanWord, createMenuItems, loadDictionariesAndPrefs, prepareLanguages, updateSettingsObject
} = require('./helpers.js')

const defaultSettings = ['disableNativeSpellcheck-false']

let user, customWords, contentPort, popupPort, currentPort, customSettings

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

// saves user specified extension settings (i.e. from popup) in browser storage
async function saveSettings (message) {
  const error = await browser.storage.sync.set({ settings: message.settings })

  if (error) {
    console.warn(`MultiDict: Saving settings failed with error: ${error}`)
  } else {
    customSettings = updateSettingsObject(message.settings)
  }
}

const getCustomWords = () => currentPort.postMessage({ type: 'getCustomWords', customWords })
const getCustomSettings = () => currentPort.postMessage({ type: 'getCustomSettings', customSettings })

// checks content for spelling errors and returns a new Spelling instance
function spellCheck (message) {
  const lang = user.getPreferredLanguage(message.detectedLanguage)
  contentPort.postMessage({
    type: 'highlight',
    spelling: new Spelling(user.spellers[lang], message.content)
  })
}

// api that handles performing all actions - core function should only ever be called by the api
function api (message) {
  switch (message.type) {
    // api always clean the text before adding/removing custom words
    case 'add':
      addCustomWord(cleanWord(message.word))
      contentPort.postMessage({ type: 'refresh' })
      break
    case 'remove':
      removeCustomWord(cleanWord(message.word))
      contentPort.postMessage({ type: 'refresh' })
      break
    case 'spellCheck':
      spellCheck(message)
      break
    case 'getCustomWords':
      getCustomWords()
      break
    case 'getCustomSettings':
      getCustomSettings()
      break
    case 'saveSettings':
      saveSettings(message)
      break
    default:
      console.warn(`MultDict: unrecognized message type ${message.type}. Aborting.`)
  }
}

// listens to all incoming messages from the popup/action menu and handle popup closing
async function popupListener (port) {
  if (!contentPort) {
    await connectToActiveTab()
  }

  popupPort = port
  currentPort = port

  if (popupPort.name === 'popup') {
    popupPort.onMessage.addListener(api)
    popupPort.onDisconnect.addListener(() => {
      popupPort.onMessage.removeListener(api)
      popupPort = null
    })
  }
}

// listens to all incoming commands (keyboard shortcuts) and context menu messages
async function commandAndContextListener (info) {
  const command = info.menuItemId || info
  if (!contentPort) {
    await connectToActiveTab()
  }
  if (command === 'add' || command === 'remove') {
    contentPort.postMessage({ type: command, word: info.selectionText })
  }
}

// listen to incoming messages from the content script and on new tab creation
async function connectToActiveTab () {
  let tab = await browser.tabs.query({ active: true, currentWindow: true })
  tab = tab[0]
  const tabName = `tab-${tab.id}`

  if (contentPort) {
    contentPort.onMessage.removeListener(api)
    contentPort.disconnect()
    contentPort = null
  }

  contentPort = browser.tabs.connect(tab.id, { name: tabName })
  contentPort.onMessage.addListener(api)
  currentPort = contentPort
}

// load dictionaries, create langauges from browser acceptLanguages, and instantiate user
async function main () {
  const languages = prepareLanguages(await browser.i18n.getAcceptLanguages())
  const dictionariesAndPrefs = await loadDictionariesAndPrefs(languages)

  customSettings = await browser.storage.sync.get('settings')
  customSettings = Array.isArray(customSettings.settings)
    ? updateSettingsObject(customSettings.settings)
    : updateSettingsObject(defaultSettings)

  customWords = await browser.storage.sync.get('personal')
  customWords = Array.isArray(customWords.personal) ? customWords.personal : []
  user = new User(dictionariesAndPrefs.dicts, dictionariesAndPrefs.prefs, languages, [...customWords])

  createMenuItems()

  console.log('langs', user.langs)
  console.log('prefs', user.prefs)
  console.log('words', user.ownWords)
  console.log('settings', customSettings)
}

main()

browser.commands.onCommand.addListener(commandAndContextListener)
browser.contextMenus.onClicked.addListener(commandAndContextListener)
browser.tabs.onCreated.addListener(connectToActiveTab)
browser.runtime.onMessage.addListener(connectToActiveTab)
browser.runtime.onConnect.addListener(popupListener)

// Goal: enable multiple laguages to be used when spell checking by detecting content language
//
// MVP: spell check using dictionaries, detect language of each field, highlight misspelled words,
// show suggestions, persistent personal dictionary
