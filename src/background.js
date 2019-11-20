const { User, Spelling } = require('./classes.js')
const { cleanWord, createMenuItems, loadDictionariesAndPrefs, prepareLanguages } = require('./helpers.js')

let user, customWords, contentPort, popupPort, currentPort

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

// returns an array of all current custom words (customWords array is in sync with user.ownWords)
const getCustomWords = () => currentPort.postMessage({ type: 'getCustomWords', customWords })

// checks content for spelling errors and returns a new Spelling instance
function spellCheck (message) {
  const lang = user.getPreferredLanguage(message.detectedLanguage)
  contentPort.postMessage({
    type: 'highlight',
    spelling: new Spelling(user.spellers[lang], message.content)
  })
}

// api that handles performing all actions (from content script, command messages, and popup menu)
function api (message) {
  switch (message.type) {
    case 'add':
      addCustomWord(message.word)
      break
    case 'remove':
      removeCustomWord(message.word)
      break
    case 'spellCheck':
      spellCheck(message)
      break
    case 'getCustomWords':
      getCustomWords()
      break
    default:
      console.warn(`MultDict: unrecognized message ${message}. Aborting.`)
  }
}

// listens to all incoming messages from the popup/action menu and handle popup closing
function popupListener (port) {
  currentPort = port
  if (port.name === 'popup') {
    popupPort = port
    popupPort.onMessage.addListener(api)
    popupPort.onDisconnect.addListener(() => {
      console.log('popup closed')
      currentPort = contentPort
      popupPort = null
    })
  }
}

// listens to all incoming commands (keyboard shortcuts)
function commandListener (command) {
  if (command === 'add' || command === 'remove') {
    contentPort.postMessage({ type: command })
  }
}

// listens to all incoming messages from the context menu items
function contextListener (info) {
  if (info.menuItemId === 'add' || info.menuItemId === 'remove') {
    api({ type: info.menuItemId, word: cleanWord(info.selectionText) })
  }
}

// listen to incoming messages from the content script and on new tab creation
async function connectToActiveTab () {
  console.log('connect to active tab')
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
}

main()

browser.commands.onCommand.addListener(commandListener)
browser.contextMenus.onClicked.addListener(contextListener)
browser.tabs.onCreated.addListener(connectToActiveTab)
browser.runtime.onMessage.addListener(connectToActiveTab)
browser.runtime.onConnect.addListener(popupListener)

// Goal: enable multiple laguages to be used when spell checking by detecting content language
//
// MVP: spell check using dictionaries, detect language of each field, highlight misspelled words,
// show suggestions, persistent personal dictionary
