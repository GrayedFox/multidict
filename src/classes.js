const nspell = require('./deps/nspell/index.js')
const { cleanText } = require('./helpers.js')

// A Spelling contains raw text, cleaned text, misspelt words, and suggestions according to a
// specific language (i.e. a single nspell/speller instance)
class Spelling {
  constructor (speller, content) {
    this.content = content // raw text string 'Hello c137! 1234 C137?'
    this.speller = speller // an nspell instance
    this.cleanedText = cleanText(content) // array of cleaned text ['Hello', 'c137', 'C137']
    this.misspeltWords = this.checkSpelling() // array of misspelt words ['c137', 'C137']
    this.suggestions = this.generateSuggestions() // suggestion object
  }

  // check the spelling of all cleaned text
  checkSpelling () {
    return this.cleanedText.reduce((acc, word) => {
      return !this.speller.correct(word) ? acc.concat([word]) : acc
    }, [])
  }

  // generates a suggestions object. The count is the amount of times the misspelt word appears
  // { misspeltWord: { suggestions: ['word1', 'word2'], count: 1 }}
  generateSuggestions () {
    this.suggestions = {}
    for (const word of this.misspeltWords) {
      const suggestedWords = this.speller.suggest(word)
      if (this.suggestions[word]) {
        this.suggestions[word].count++
      }

      if (suggestedWords.length > 0) {
        this.suggestions[word] = { suggestedWords, count: 1 }
      }
    }

    return this.suggestions
  }

  // return the top N suggestions for a misspelt word
  getSuggestions (word, limit = 9) {
    return this.suggestions[word].suggestedWords.slice(0, limit)
  }
}

// A User has user dictionaries, preferences, spelling instances, and custom words
class User {
  constructor (dictionaries, prefs, languages, ownWords) {
    this.dicts = dictionaries // dictionary objects [{ language: 'en-au', dic: '', aff: '' }]
    this.prefs = prefs // shorthand language strings ['au', 'de', 'gb']
    this.langs = languages // language strings ['en-au', 'de-de', 'en-gb']
    this.ownWords = ownWords // word strings ['kablam', 'shizzle']
    this.spellers = this.createSpellers() // nspell instances by pref (language) { pref: nspell }
  }

  // create spell checkers in order of languages specified by user
  createSpellers () {
    if (this.prefs.length !== this.dicts.length) {
      console.warn('MultiDict: Language prefs and user dictionary length not equal. Aborting.')
      return
    }

    this.spellers = {}

    for (let i = 0; i < this.dicts.length; i++) {
      this.spellers[this.prefs[i]] = nspell(this.dicts[i])
    }

    const spellingLangs = Object.keys(this.spellers)

    if (this.ownWords.length > 0) {
      Object.values(this.ownWords).forEach((word) => {
        spellingLangs.forEach((language) => this.spellers[language].add(word))
      })
    }

    return this.spellers
  }

  // get the user's preferred language to spell check content of a specific language
  getPreferredLanguage (contentLanguage) {
    for (const pref of this.prefs) {
      if (this.langs.includes(`${contentLanguage}-${pref}`)) {
        return pref
      }
    }
    return this.prefs[0]
  }

  // add word to user.ownWords and update existing spell checker instances
  addWord (word) {
    this.ownWords.push(word)
    Object.keys(this.spellers).forEach((language) => { this.spellers[language].add(word) })
  }

  // remove word from user.ownWords and update existing spell checker instances
  removeWord (word) {
    this.ownWords.remove(word)
    Object.keys(this.spellers).forEach((language) => { this.spellers[language].remove(word) })
  }
}

// A Word is an iterable class that contains a word, its length, and word boundaries
class Word {
  constructor (word, start, end) {
    this.text = word
    this.start = Number.parseInt(start)
    this.end = Number.parseInt(end)
    this.length = word.length
  }

  // the word is valid if the length of the word is greater than 0
  isValid () {
    return this.length > 0
  }

  // make Word iterable (values only)
  [Symbol.iterator] () {
    return [this.text, this.start, this.end].values()
  }
}

module.exports = {
  Spelling,
  User,
  Word
}
