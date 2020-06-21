const nspell = require('./deps/nspell/index')
const { cleanText, getRelativeBounds } = require('./text-methods')

// A Spelling contains raw text, cleaned text, misspelt Words, and suggestions according to a
// specific language (i.e. a single nspell/speller instance)
class Spelling {
  constructor (speller, content) {
    this.content = content // raw text string 'Hello c137! 1234 C137? email@fu.com'
    this.speller = speller // an nspell instance
    this._cleanedText = cleanText(content) // array of cleaned text ['Hello', 'c137', 'C137']
    this.misspeltStrings = this._checkSpelling() // array of misspelt strings ['word', 'word']
    this.misspeltWords = this._generateWords() // array of misspelt Words [{Word}, {Word}]
    this.suggestions = this._generateSuggestions() // suggestion object (see generator)
  }

  // returns array of misspelt strings only
  _checkSpelling () {
    return this._cleanedText.filter(word => !this.speller.correct(word))
  }

  // constructs array of misspelt Words by checking the spelling of each bit of cleaned text
  _generateWords () {
    let index = 0
    return this.misspeltStrings.map(word => {
      index = this.content.indexOf(word, index + word.length)
      return new Word(word, ...getRelativeBounds(word, this.content, index))
    })
  }

  // generates a suggestions object: { misspeltWord: { suggestions: ['word1', 'word2'], count: 1 }}
  // should only be called on class instantiation (count is amount of times a misspelt word appears)
  _generateSuggestions () {
    this.suggestions = {}
    for (let i = 0; i < this.misspeltWords.length; i++) {
      const word = this.misspeltWords[i].text
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
}

// A SuggestionTracker is used to keep track of which suggestion is currently being shown to the
// user. It requires a suggestions object (from a Spelling) and will update suggestionsIndex
// variable based on the direction a user is 'scrolling' through any suggestions
class SuggestionTracker {
  constructor (suggestions) {
    this.suggestions = suggestions
    this._suggestionIndex = 0
  }

  get currentSuggestion () {
    return this.suggestions[this._suggestionIndex]
  }

  // rotate the suggestions up or down
  rotate (direction) {
    direction === 'up' ? this._suggestionIndex++ : this._suggestionIndex--
    if (this._suggestionIndex === this.suggestions.length) {
      this._suggestionIndex = 0
    }
    if (this._suggestionIndex < 0) {
      this._suggestionIndex = this.suggestions.length - 1
    }
  }
}

// A User has user dictionaries, preferences, spelling instances, and custom words
class User {
  constructor (dictionaries, prefs, languages, ownWords) {
    this.dicts = dictionaries // dictionary objects [{ language: 'en-au', dic: '', aff: '' }]
    this.prefs = prefs // shorthand language strings ['au', 'de', 'gb']
    this.langs = languages // language strings ['en-au', 'de-de', 'en-gb']
    this.ownWords = ownWords // word strings ['kablam', 'shizzle']
    this.spellers = this._createSpellers() // nspell instances by pref (language) { pref: nspell }
  }

  // get the user's preferred (or default) language when spell checking content
  getPreferredLanguage (contentLanguage) {
    for (const pref of this.prefs) {
      if (this.langs.includes(`${contentLanguage}-${pref}`)) {
        return pref
      }
    }
    // default to first preferred language if no match found
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

  // create spell checkers in order of languages specified by user
  // should only be called once during class instantiation
  _createSpellers () {
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
}

// A Word is an iterable class that contains some text, its length, and word boundaries
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
  SuggestionTracker,
  User,
  Word
}
