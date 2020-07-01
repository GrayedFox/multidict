const nspell = require('nspell')
const { cleanText, getRelativeBounds } = require('./text-methods')

// A CustomWordList is a dummy class that helps to iterate over and perform operations on a custom
// words list. The wordlist should be an object with the following structure:
// { kablam: ['de-de', 'en-au', 'en-gb'], ... }
class CustomWordList {
  constructor (wordList) {
    this._wordList = this._generateWordList(wordList)
  }

  add (word, languages) {
    this._wordList[word] = languages
  }

  remove (word) {
    delete this._wordList[word]
  }

  get words () {
    return Object.keys(this._wordList)
  }

  get wordList () {
    return this._wordList
  }

  // convert original style wordList (array of strings) to object of arrays
  // ensures backwards compatibility after breaking changes (so users don't lose custom words)
  _generateWordList (wordList) {
    if (typeof wordList === 'object' && !Array.isArray(wordList)) return wordList
    if (Array.isArray(wordList)) {
      const wordListObect = {}
      wordList.forEach(word => { wordListObect[word] = [] })
      return wordListObect
    }
  }
}

// A Spelling contains raw text, cleaned text, misspelt Words, and suggestions according to a
// specific language (i.e. a single nspell/speller instance)
class Spelling {
  constructor (speller, content) {
    this.content = content // raw text string 'Hello c137! 1234 C137? email@fu.com'
    this.speller = speller // an nspell instance
    this._cleanedText = cleanText(content) // array of cleaned text ['Hello', 'c137', 'C137']
    this.misspeltStrings = this._generateStrings() // array of misspelt strings ['word', 'word']
    this.misspeltWords = this._generateWords() // array of misspelt Words [{Word}, {Word}]
    this.suggestions = this._generateSuggestions() // suggestion object (see generator)
  }

  // returns array of misspelt strings only
  _generateStrings () {
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
    this._dicts = dictionaries // dictionary objects [{ language: 'en-au', dic: '', aff: '' }]
    this._prefs = prefs // shorthand language strings ['au', 'de', 'gb']
    this._langs = languages // language strings ['en-au', 'de-de', 'en-gb']
    this._ownWords = JSON.parse(JSON.stringify(ownWords)) // clone of custom word list: { kablam: ['de-de', 'po-po'], ... }
    this._spellers = this._createSpellers() // nspell instances by language { language: nspell }
  }

  get dicts () {
    return this._dicts
  }

  get prefs () {
    return this._prefs
  }

  get langs () {
    return this._langs
  }

  get spellers () {
    return this._spellers
  }

  // get the user's preferred (or default) language when spell checking content
  getPreferredLanguage (contentLanguage) {
    for (const pref of this._prefs) {
      if (this._langs.includes(`${contentLanguage}-${pref}`)) {
        return `${contentLanguage}-${pref}`
      }
    }
    // default to first preferred language if no match found
    return `${this._langs[0]}`
  }

  // private method for working around this bug: https://github.com/wooorm/nspell/issues/25
  _fixWord (word, speller) {
    speller.remove(word)
    speller.add(word)
  }

  // add word to user._ownWords and update existing spell checker instances
  addWord (word) {
    const misspeltLangs = []
    this._langs.forEach(language => {
      const speller = this._spellers[language]
      if (!speller.correct(word)) {
        speller.add(word)
        misspeltLangs.push(language)
        if (!speller.correct(word)) this._fixWord(word, speller)
      }
    })
    if (misspeltLangs.length > 0) { this._ownWords[word] = misspeltLangs }
  }

  // remove word from user._ownWords and update existing spell checker instances
  removeWord (word) {
    // users can add custom words that are already spelt correctly in all languages, which would
    // result in them being here undefined
    if (!this._ownWords[word]) return
    this._ownWords[word].forEach(language => {
      if (this._spellers[language]) this._spellers[language].remove(word)
    })
    delete this._ownWords[word]
  }

  // create spell checkers (nspell instaces) should only ever be called during class instantiation
  _createSpellers () {
    if (this._prefs.length !== this._dicts.length) {
      console.warn('Multidict: Language prefs and user dictionary length not equal. Aborting.')
      return
    }

    this._spellers = {}

    for (let i = 0; i < this._dicts.length; i++) {
      this._spellers[this._langs[i]] = nspell(this._dicts[i])
    }

    if (Object.keys(this._ownWords).length > 0) {
      Object.keys(this._ownWords).forEach((word) => { this.addWord(word) })
    }

    return this._spellers
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
  CustomWordList,
  Spelling,
  SuggestionTracker,
  User,
  Word
}
