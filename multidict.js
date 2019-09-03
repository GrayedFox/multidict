const nspell = require('./nspell/index.js')
const { loadDictionaries } = require('./helpers.js')

let messageHandler
let dictionaries = []
let languages = []
let languagePrefs = {}
let spells = {}

// create spell checkers in order of languages specified by user
function createSpellCheckers (languagePrefs, dictionaries) {
  if (languagePrefs.length !== dictionaries.length) {
    console.error('Language and dictionary length are not equal. Aborting.')
    return
  }

  const spells = {}

  for (let i = 0; i < dictionaries.length; i++) {
    spells[languagePrefs[i]] = nspell(dictionaries[i])
  }

  return spells
}

// return suggestions for misspelt words
function checkSpelling (spell, content) {
  // split string by spaces and strip out punctuation that does not form part of the word itself
  // then remove any strings that are numbers or less than 1 char in length
  const cleanedContent = content.split(/(?:\s)/)
    .reduce((acc, string) => acc.concat([string.replace(/(\B\W|\W\B|\s)/gm, '')]), [])
    .reduce((acc, string) => {
      return string.length > 1 && isNaN(string) && !string.includes('@')
        ? acc.concat([string])
        : acc
    }, [])
  // BUG: click event listener sends single line of text instead of content of entire editable field

  console.log(cleanedContent)

  return cleanedContent.reduce((acc, string) => {
    return !spell.correct(string) ? acc.concat([[string, spell.suggest(string)]]) : acc
  }, [])
}

function listener (message) {
  messageHandler = message
  messageHandler.postMessage({ greeting: 'Connection established' })

  messageHandler.onMessage.addListener((message) => {
    if (message.language === 'unreliable') {
      messageHandler.postMessage(checkSpelling(spells[languagePrefs[0]], message.content))
    } else {
      for (const pref of languagePrefs) {
        if (languages.includes(`${message.language}-${pref}`)) {
          messageHandler.postMessage(checkSpelling(spells[pref], message.content))
          break
        }
      }
    }
  })
}

// main function which loads dictionaries and creates NSpell dictionary instances
async function main () {
  languages = await browser.i18n.getAcceptLanguages()
  dictionaries = await loadDictionaries(languages)
  languagePrefs = languages.reduce((acc, lang) => acc.concat([lang.slice(3, 5)]), [])
  spells = createSpellCheckers(languagePrefs, dictionaries)

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
