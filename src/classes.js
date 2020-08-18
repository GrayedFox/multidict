const nspell = require('nspell')
const { cleanText, getRelativeBounds } = require('./text-methods')

/** Class representing a list of custom words. A CustomWordList is a dummy class that helps to
 * iterate over and perform operations on the user's custom words which are loaded from browser
 * storage.
 */
class CustomWordList {
  /**
   * Create a CustomWordList. Words are sorted alphabetically using the provided locale on creation
   *
   * @param  {WordList|string[]} wordList - an array of custom words or object of words and languages
   * @param  {string} locale - the locale (i.e. 'en' or 'de') used to sort the custom words
   */
  constructor (wordList, locale) {
    this._wordList = this._generateWordList(wordList)
    this.sort(locale)
  }

  /**
   * Adds a word to the CustomWordList. Note that adding a word does not call sort().
   *
   * @param  {string} word - word to add
   * @param  {string[]} languages - the languages the word the word is misspelt in
   */
  add (word, languages) {
    this._wordList[word] = languages
    this._words.push(word)
  }

  /**
   * Removes a word from the CustomWordList
   *
   * @param  {string} word - word to be remove
   */
  remove (word) {
    delete this._wordList[word]
    this._words.remove(word)
  }

  /**
   * Get all custom words
   *
   * @returns {string[]} The custom words only (no languages)
   */
  get words () {
    return this._words
  }

  /**
   * Get an unsorted wordList object that includes each word and the languages it is misspelt in
   *
   * @returns {WordList} Object of words and languages
   */
  get wordList () {
    return this._wordList
  }

  /**
   * Sort all custom words alphabetically based on a specific locale
   *
   * @param  {string} locale - a two character length language string (i.e. 'de' or 'es')
   */
  sort (locale) {
    this._words = Object.keys(this._wordList).sort((a, b) => a.localeCompare(b, locale))
  }

  /**
   * A WordList object has misspelt words and the languages they are misspelt in.
   *
   * @typedef {Object} WordList
   * @see CustomWordList
   * @property {string[]} misspeltWord - array of languages the word is misspelt in
   */

  /**
   * Convert original style wordList (array of strings) into object of arrays. Ensures backwards
   * compatibility after breaking changes (so users don't lose custom words)
   *
   * @private
   * @param  {WordList|string[]} wordList - object or array of strings
   * @returns {WordList} A WordList
   */
  _generateWordList (wordList) {
    if (typeof wordList === 'object' && !Array.isArray(wordList)) return wordList
    const wordListObject = {}
    wordList.forEach(word => { wordListObject[word] = [] })
    return wordListObject
  }
}

/**
 * A Dictionary class represents a language, a dictionary of valid words in that language, and a
 * rule set (aff file) that defines valid word forms (i.e. plurals, capitilisation, etc)
 *
 *  @see User
  * @see {@link https://github.com/wooorm/nspell#nspellaff-dic|NSpell Dictionary Object}
*/
class Dictionary {
  /**
   * Create a Dictionary class from a dictionary object
   *
   * @param    {object} dictionary - a dictionary object
   * @property {string} dictionary.language - a fully formed language code i.e. 'en-au' or 'de-de'
   * @property {string} dictionary.dic - a complete string representation of a dic file
   * @property {string} dictionary.aff - a complete string representation of an aff file
   */
  constructor (dictionaryObject) {
    this.language = dictionaryObject.language
    this.dic = dictionaryObject.dic
    this.aff = dictionaryObject.aff
  }

  // make Dictionary iterable (all values)
  [Symbol.iterator] () {
    return [this.language, this.dic, this.aff].values()
  }
}

/**
 * Class representing the spell checked content which contains the raw text, cleaned text, misspelt
 * Words, and spelling suggestions according to a specific language (i.e. a single NSpell instance).
 * The methods, while documented, are private and should not be called outside class instantiation.
 */
class Spelling {
  /**
   * Create a Spelling class
   *
   * @param  {NSpell} speller - an nspell instance
   * @param  {string} content - the content to be spell checked
   */
  constructor (speller, content) {
    this.content = content
    this.speller = speller
    this._cleanedText = cleanText(content)
    this.misspeltStrings = this._generateStrings()
    this.misspeltWords = this._generateWords()
    this.suggestions = this._generateSuggestions()
  }

  /**
   * Generates misspelt strings. Should only be called during class instantiation.
   *
   * @returns {string[]} An array of misspelt strings
   */
  _generateStrings () {
    return this._cleanedText.filter(word => !this.speller.correct(word))
  }

  /**
   * Generates array of misspelt Words by checking the spelling of each bit of cleaned text.
   * Should only be called during class instantiation.
   *
   * @see Word
   * @returns {Word[]} An array of misspelt Words
   */
  _generateWords () {
    let index = 0
    return this.misspeltStrings.map(word => {
      index = this.content.indexOf(word, index + word.length)
      return new Word(word, ...getRelativeBounds(word, this.content, index))
    })
  }

  /**
   * A Suggestions object contains multiple misspelt words as nested objects with the following
   * properties.
   *
   * @typedef {Object} Suggestions
   * @property {Object} misspeltWord - a sequence of tokens representing the misspelt word
   * @property {string[]} misspeltWord.suggestedWords - an array of string suggestions
   * @property {number} misspeltWord.count - the amount of times this exact sequence of tokens
   * appears inside the text content
   */

  /**
   * Generates a Suggestions object. Should only be called during class instantiation.
   *
   * @returns {Suggestions} A Suggestions object
   */
  _generateSuggestions () {
    this.suggestions = {}
    for (let i = 0; i < this.misspeltWords.length; i++) {
      const word = this.misspeltWords[i].text
      const suggestedWords = this.speller.suggest(word)
      if (this.suggestions[word]) {
        this.suggestions[word].count++
      } else if (suggestedWords.length > 0) {
        this.suggestions[word] = { suggestedWords, count: 1 }
      }
    }

    return this.suggestions
  }
}

/**
 * Class representing a list of suggestions for a misspelt word. It will keep track of which
 * suggestion is currently being shown to the user.
 */
class SuggestionTracker {
  /**
   * Create a SuggestionTracker
   *
   * @param  {string[]} suggestions - array of suggestion strings
   */
  constructor (suggestions) {
    this.suggestions = suggestions
    this._suggestionIndex = suggestions.length - 1
  }

  /**
   * Get the currently shown/inlined suggestion
   *
   * @returns {string} The currently shown/inlined suggestion
   */
  get currentSuggestion () {
    return this.suggestions[this._suggestionIndex]
  }

  /**
   * Cycle through suggestions in a given direction
   *
   * @param  {string} direction - either 'up' or 'down'
   */
  cycle (direction) {
    direction === 'up' ? this._suggestionIndex++ : this._suggestionIndex--
    if (this._suggestionIndex === this.suggestions.length) {
      this._suggestionIndex = 0
    }
    if (this._suggestionIndex < 0) {
      this._suggestionIndex = this.suggestions.length - 1
    }
  }
}

/**
 * Class representing a user. A User has dictionaries, spelling instances, and custom/own words.
 */
class User {
  /**
   * Create a User
   *
   * @param  {object[]} dictionaries - array of dictionary objects
   * @param  {string[]} languages - array of five digit language codes
   * @param  {object[]} ownWords - array of user saved custom word objects
   */
  constructor (dictionaries, languages, ownWords) {
    this._dicts = this._createDictionaries(dictionaries) // dictionary objects [{ language: 'en-au', dic: '', aff: '' }]
    this._langs = languages // language strings ['en-au', 'de-de', 'en-gb']
    this._ownWords = ownWords // array of user saved custom words
    this._spellers = this._createSpellers() // nspell instances by language { language: nspell }
  }

  /**
   * Gets the user's dictionaries
   * @returns {Dictionary[]} - array of user Dictionaries
   */
  get dicts () {
    return this._dicts
  }

  /**
   * Gets the user's languages. These are ordered by language preference.
   * @returns {string[]} - array of language codes
   */
  get langs () {
    return this._langs
  }

  /**
   * Gets the user's nspell (Speller) instances
   * @see {@link https://github.com/wooorm/nspell#table-of-contents|NSpell}
   * @returns {nspell[]} An array of nspell instances (Spellers)
   */
  get spellers () {
    return this._spellers
  }

  /**
   * Gets the user's preferred (or default) language when spell checking content
   * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/i18n/LanguageCode|Language Code}
   * @param  {string} contentLanguage - two character length locale i.e. 'de' or 'au'
   * @returns {string} - a five character length language code i.e. 'en-au' or 'de-de'
   */
  getPreferredLanguage (contentLanguage) {
    for (const language of this._langs) {
      const locale = language.substr(3, 5)
      if (this._langs.includes(`${contentLanguage}-${locale}`)) {
        return `${contentLanguage}-${locale}`
      }
    }
    // default to first preferred language if no match found
    return `${this._langs[0]}`
  }

  /**
   * Sets the preferred language order of a user based on a sorted array of languages
   * @param  {string[]} languages - array of language codes i.e. ['de-de', 'en-au']
   */
  setPreferredLanguageOrder (languages) {
    const newLangs = []
    for (let i = 0; i < languages.length; i++) {
      if (this._langs.includes(languages[i])) {
        newLangs.push(languages[i])
      }
    }
    this._langs = newLangs
  }

  /**
   * Adds a word to user's custom/own words and updates existing spellchecker instances
   *
   * @param  {string} word - word string to be added
   */
  addWord (word) {
    const misspeltLangs = []
    this._langs.forEach(language => {
      const speller = this._spellers[language]
      if (!speller.correct(word)) {
        speller.add(word)
        misspeltLangs.push(language)
        if (!speller.correct(word)) this._fixWord(word, speller, language)
      }
    })
    if (misspeltLangs.length > 0) { this._ownWords[word] = misspeltLangs }
  }

  /**
   * Removes a word from user's custom/own words and updates existing spellchecker instances
   *
   * @param  {string} word - word string to be removed
   */
  removeWord (word) {
    // users may attempt (using shortcuts) to remove words that are not in their custom word list
    // which would result in them being here undefined
    if (!this._ownWords[word]) return
    this._ownWords[word].forEach(language => {
      this._spellers[language].remove(word)
    })
    delete this._ownWords[word]
  }

  // private method for working around this bug: https://github.com/wooorm/nspell/issues/25
  _fixWord (word, speller, language) {
    console.warn(`Multidict: fixing word ${word} to be correct in ${language}`)
    speller.remove(word)
    speller.add(word)
  }

  // _createSpellers should only ever be called during class instantiation - creates nspell instances
  _createSpellers () {
    if (this._langs.length !== this._dicts.length) {
      throw new RangeError('Languages and user dictionary length must be equal. Aborting.')
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

  // _createDictionaries should only ever be called during class instantiation - creates Dictionary instances
  _createDictionaries (dictionaries) {
    const dicts = []
    dictionaries.forEach(dictionaryObject => {
      dicts.push(new Dictionary(dictionaryObject))
    })
    return dicts
  }
}

/** A Word is an iterable class that contains some text, its length, and relative word boundaries.
 *  Iterating over a Word will yield the word itself followed by the start and then end values.
 */
class Word {
  /**
   * Create a Word
   *
   * @param  {string} word - the string we will be using to create the Word
   * @param  {number} start - the beginning of the word relative to the content it was created from
   * @param  {number} end - the end of the word relative to the content it was created from
   */
  constructor (word, start, end) {
    this.text = word
    this.start = Number.parseInt(start)
    this.end = Number.parseInt(end)
    this.length = word.length
  }

  /**
   * Check if the word is valid
   *
   * @returns {boolean} True if the length of the word is greater than 0
   */
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
  Dictionary,
  Spelling,
  SuggestionTracker,
  User,
  Word
}
