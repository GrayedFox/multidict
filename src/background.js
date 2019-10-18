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
    console.error(`MultiDict: Adding to personal dictionary failed with error: ${error}`)
  } else {
    customWords.push(word)
    user.addWord(word)
  }

  console.log('add result', customWords)
}

// removes a word from browser storage and calls user.removeWord
async function removeCustomWord (word) {
  if (!word || !customWords.includes(word)) {
    return
  }

  const error = await browser.storage.sync.set({ personal: [...customWords].remove(word) })

  if (error) {
    console.error(`MultiDict: Removing from personal dictionary failed with error: ${error}`)
  } else {
    customWords.remove(word)
    user.removeWord(word)
  }

  console.log('remove result', customWords)
}

// returns an array all current custom words
const getCustomWords = () => currentPort.postMessage({ type: 'getWords', customWords })

// checks content for spelling errors and returns a new Spelling instance
function check (message) {
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
    case 'check':
      check(message)
      break
    case 'getWords':
      getCustomWords()
      break
    default:
      console.warn(`MultDict: unrecognized message ${message}. Aborting.`)
  }
}

// listens to all incoming messages from the content script and browser popup/action menu
function contentAndPopupListener (port) {
  if (port.name === 'popup') {
    popupPort = port
    currentPort = popupPort
    popupPort.onMessage.addListener(api)
  }
  if (port.name === 'content') {
    contentPort = port
    currentPort = contentPort
    contentPort.onMessage.addListener(api)
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

browser.runtime.onConnect.addListener(contentAndPopupListener)
browser.commands.onCommand.addListener(commandListener)
browser.contextMenus.onClicked.addListener(contextListener)

// Goal: enable multiple laguages to be used when spell checking by detecting content language
//
// MVP: spell check using dictionaries, detect language of each field, highlight misspelled words,
// show suggestions, persistent personal dictionary
