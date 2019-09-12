const nspell = require('./deps/nspell/index.js')
const { checkSpelling, createMenuItems, loadDictionariesAndPrefs } = require('./helpers.js')

let user
let customWords
let messageHandler

class User {
  constructor (dictionaries, prefs, languages, ownWords) {
    this.dicts = dictionaries // dictionary objects [{ language: 'en-au', dic: '', aff: '' }]
    this.prefs = prefs // shorthand language strings ['au', 'de']
    this.langs = languages // language strings ['en-au', 'de-de']
    this.ownWords = ownWords // word strings ['kablam', 'shebang']
    this.spells = this.createSpellCheckers() // nspell instances
  }

  // create spell checkers in order of languages specified by user
  createSpellCheckers () {
    if (this.prefs.length !== this.dicts.length) {
      console.warn('MultiDict: Language prefs and user dictionary length not equal. Aborting.')
      return
    }

    const spells = {}
    for (let i = 0; i < this.dicts.length; i++) {
      spells[this.prefs[i]] = nspell(this.dicts[i])
    }
    return spells
  }

  // add word to user.ownWords and update existing spell checker instances
  addWord (word) {
    user.ownWords.push(word)
    Object.keys(this.spells).forEach((language) => { this.spells[language].add(word) })
  }

  // remove word from user.ownWords and update existing spell checker instances
  removeWord (word) {
    user.ownWords.remove(word)
    Object.keys(this.spells).forEach((language) => { this.spells[language].remove(word) })
  }
}

// expected: { type: '', detectedLanguage: '', content: '' }
// checkSpelling returns: { cleanedContent: [], misspeltWords: [], suggestions: {}}
function check (message) {
  switch (message.detectedLanguage) {
    case 'unreliable':
      messageHandler.postMessage({
        type: 'spelling',
        suggestions: checkSpelling(user.spells[user.prefs[0]], message.content)
      })
      break

    default:
      for (const pref of user.prefs) {
        if (user.langs.includes(`${message.detectedLanguage}-${pref}`)) {
          messageHandler.postMessage({
            type: 'spelling',
            spelling: checkSpelling(user.spells[pref], message.content)
          })
          break
        }
      }
  }
}

// saves a word in browser storage and calls user.addWord
async function addCustomWord (word) {
  if (customWords.includes(word)) {
    return
  }

  console.log('saving word: ' + word)

  customWords.push(word)
  const error = await browser.storage.sync.set({ personal: customWords })

  if (error) {
    customWords.pop() // remove the last word we added to customWords if we fail to save it
    console.error(`MultiDict: Adding to personal dictionary failed with error: ${error}`)
  } else {
    user.addWord(word)
  }
}

// removes a word from browser storage and calls user.removeWord
async function removeCustomWord (word) {
  if (!customWords.includes(word)) {
    return
  }

  console.log('deleting word :' + word)

  customWords.remove(word)
  const error = await browser.storage.sync.set({ personal: customWords })

  if (error) {
    customWords.push(word) // re-add the last word we removed to customWords if we fail to remove it
    console.error(`MultiDict: Removing from personal dictionary failed with error: ${error}`)
  } else {
    user.removeWord(word)
  }
}

// api that handles performing all actions (from content script and command messages)
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
    default:
      console.warn(`MultDict: unrecognized message ${message}. Aborting.`)
  }
}

// listens to all incoming messages from the content script
function contentListener (port) {
  messageHandler = port
  messageHandler.postMessage({ type: 'greeting', greeting: 'MultDict connection established.' })
  messageHandler.onMessage.addListener(api)
}

// listens to all incoming commands (keyboard shortcuts)
function commandListener (command) {
  if (command === 'add' || command === 'remove') {
    messageHandler.postMessage({ type: command })
  }
}

// listens to all incoming messages from the context menu items
function contextListener (info) {
  if (info.menuItemId === 'add' || info.menuItemId === 'remove') {
    api({ type: info.menuItemId, word: info.selectionText })
  }
}

// load dictionaries from acceptLanguages and intantiate user
async function main () {
  const languages = await browser.i18n.getAcceptLanguages()
  const dictionariesAndPrefs = await loadDictionariesAndPrefs(languages)

  customWords = await browser.storage.sync.get('personal')
  customWords = Array.isArray(customWords) ? customWords : []
  user = new User(dictionariesAndPrefs.dicts, dictionariesAndPrefs.prefs, languages, customWords)

  createMenuItems()

  console.log(user.langs)
  console.log(user.prefs)
  console.log(user.ownWords)
}

main()

browser.runtime.onConnect.addListener(contentListener)
browser.commands.onCommand.addListener(commandListener)
browser.contextMenus.onClicked.addListener(contextListener)

// Goal: enable multiple laguages to be used when spell checking by detecting content language
//
// MVP: spell check using dictionaries, detect language of each field, underline misspelled words,
// show suggestions
// V2: persistent personal dictionary to add words to
