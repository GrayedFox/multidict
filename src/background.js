const nspell = require('./deps/nspell/index.js')
const { checkSpelling, loadDictionariesAndPrefs } = require('./helpers.js')

let messageHandler
let languages = []
let languagePrefs = []
let spells = {}

// create spell checkers in order of languages specified by user
function createSpellCheckers (user) {
  if (languagePrefs.length !== user.dicts.length) {
    console.warn('Language prefs and user dictionary length are not equal. Aborting.')
    return
  }

  const spellCheckers = {}

  for (let i = 0; i < user.dicts.length; i++) {
    spellCheckers[languagePrefs[i]] = nspell(user.dicts[i])
  }

  return spellCheckers
}

// handles all incoming messages from the content script
function listener (message) {
  messageHandler = message
  messageHandler.postMessage({ greeting: 'MultDict connection established' })

  // content script message object should contain: { name, language, content }
  messageHandler.onMessage.addListener((message) => {
    if (message.language === 'unreliable') {
      messageHandler.postMessage({
        suggestions: checkSpelling(spells[languagePrefs[0]], message.content)
      })
    } else {
      for (const pref of languagePrefs) {
        if (languages.includes(`${message.language}-${pref}`)) {
          messageHandler.postMessage({
            spelling: checkSpelling(spells[pref], message.content)
          })
          break
        }
      }
    }
  })
}

// main function loads dictionaries, sets langauge prefs, and creates NSpell dictionary instances
async function main () {
  languages = await browser.i18n.getAcceptLanguages()
  const user = await loadDictionariesAndPrefs(languages)
  languagePrefs = user.prefs.reduce((acc, lang) => acc.concat([lang.slice(3, 5)]), [])
  spells = createSpellCheckers(user)

  console.log(languages)
  console.log(languagePrefs)
}

browser.runtime.onConnect.addListener(listener)

main()

// Goal: enable multiple laguages to be used when spell checking
//
// Limits: no way to directly interact right now with browser dictionary list so have to build
// spell check/lookup functionality
//
// Method: user should disable browser spell check (to avoid annoying/false red lines) and rely
// on the extension
//
// MVP: spell check using dictionaries, detect language of each field, underline misspelled words,
// show suggestions
// V2: persistent personal dictionary to add words to
