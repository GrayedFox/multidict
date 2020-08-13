const { assert } = require('chai')
const { readFile } = require('./setup')
const { CustomWordList, Dictionary, Spelling, SuggestionTracker, Word, User } = require('../src/classes')
const nspell = require('nspell')

// read dictionary aff and dic files from disk and return an dictionary object
const loadDictionary = async (language) => {
  const dict = { language }
  try {
    const affData = await readFile(`dictionaries/${language}.aff`, 'utf8')
    if (affData) dict.aff = affData
    const dicData = await readFile(`dictionaries/${language}.dic`, 'utf8')
    if (dicData) dict.dic = dicData
  } catch (err) {
    assert.fail('Could not read dictionary file', '', err)
  }
  return dict
}

describe('CustomWordList Class', function () {
  const wordListArray = ['kablam', 'shizzle', 'awesome-sauce']
  const wordListObject = { kablam: ['de-de'], shizzle: ['fr-fr', 'en-au'], 'awesome-sauce': [] }
  const languages = ['de-de', 'en-au']
  const locale = 'en'

  let obj = new CustomWordList(wordListArray, locale)

  it('asserts object is instance of CustomWordList', function () {
    assert.instanceOf(obj, CustomWordList)
  })

  it('asserts object.wordList is an object with words as keys if created with array of strings', function () {
    assert.typeOf(obj.wordList, 'object', 'wordList is an object')
    assert.hasAllKeys(obj.wordList, wordListArray, 'wordList has keys "kablam", "shizzle", "awesome-sauce"')
  })

  it('asserts object.wordList is an object with words as keys if created with object of key value pairs', function () {
    obj = new CustomWordList(wordListObject, locale)
    assert.typeOf(obj.wordList, 'object', 'wordList is an object')
    assert.hasAllKeys(obj.wordList, wordListArray, 'wordList has keys "kablam", "shizzle", "awesome-sauce"')
  })

  it('asserts object has correct word and languages added after using add()', function () {
    obj.add('snuckles', languages)
    assert.include(obj.words, 'snuckles', 'Word "snuckles" added to words')
    assert.includeMembers(obj.wordList.snuckles, languages, 'Word "snuckles" has languages "de-de" and "en-au"')
    assert.notInclude(obj.wordList.snuckles, 'fr-fr', 'Word "snuckles" does not have language "fr-fr"')
  })

  it('asserts object has correct word removed after using remove()', function () {
    obj.remove('shizzle')
    assert.notInclude(obj.words, 'shizzle', 'Word "shizzle" removed from words')
    assert.hasAllKeys(obj.wordList, ['kablam', 'awesome-sauce', 'snuckles'], 'Word "shizzle" removed from wordList')
  })

  it('asserts words are sorted alphabetically after calling sort()', function () {
    obj.sort(locale)
    assert.sameOrderedMembers(obj.words, ['awesome-sauce', 'kablam', 'snuckles'], 'Words sorted alphabetically')
  })
})

describe('Dictionary Class', function () {
  let dictionaryObject
  let obj

  before(async function () {
    this.timeout(5000)
    dictionaryObject = await loadDictionary('en-au')
    obj = new Dictionary(dictionaryObject)
  })

  it('asserts object is instance of Dictionary', function () {
    assert.instanceOf(obj, Dictionary)
  })

  it('asserts object is iterable and returns language, dic, and aff values in that exact order', function () {
    assert.sameOrderedMembers([...obj], ['en-au', dictionaryObject.dic, dictionaryObject.aff])
  })
})

describe('Spelling Class', function () {
  const content = 'A colorful text that should be colorful shizzleflaps when Spelling class instantiated! 1337'
  let dictionary
  let speller
  let obj

  before(async function () {
    this.timeout(5000)
    dictionary = await loadDictionary('en-au')
    speller = nspell(dictionary)
    obj = new Spelling(speller, content)
  })

  it('asserts object is instance of Spelling', function () {
    assert.instanceOf(obj, Spelling)
  })

  it('asserts object.misspeltStrings does not include number 1337', function () {
    assert.notInclude(obj.misspeltStrings, '1337')
  })

  it('asserts object.misspeltStrings includes word "colorful" twice and word shizzleflaps once', function () {
    assert.sameMembers(obj.misspeltStrings, ['colorful', 'colorful', 'shizzleflaps'])
  })

  it('asserts object.misspeltWords is an array of exactly 3 Word instances', function () {
    obj.misspeltWords.every(word => assert.instanceOf(word, Word, `${word} is instance of word`))
    assert.lengthOf(obj.misspeltWords, 3, 'misspeltWords has length of 3')
  })

  it('asserts object.suggestions.colorful has nested suggestions key', function () {
    assert.nestedProperty(obj.suggestions.colorful, 'suggestedWords', 'Colorful has nested key "suggestions"')
  })

  it('asserts object.suggestions.colorful has nested count key with value 2', function () {
    assert.nestedPropertyVal(obj.suggestions.colorful, 'count', 2, 'Nested count key equals 2')
  })

  it('asserts that object has no suggestions for shizzleflaps', function () {
    assert.isUndefined(obj.suggestions.shizzleflaps)
  })
})

describe('SuggestionTracker Class', function () {
  const suggestions = ['trot', 'brow', 'broth', 'rot']
  const obj = new SuggestionTracker(suggestions)

  it('asserts object is instance of SuggestionTracker', function () {
    assert.instanceOf(obj, SuggestionTracker)
  })

  it('asserts that object.currentSuggestion is first suggestion after calling cycle("up")', function () {
    obj.cycle('up')
    assert.equal(obj.currentSuggestion, 'trot')
  })

  it('asserts that object.currentSuggestion shows last suggestion after calling cycle("down")', function () {
    obj.cycle('down')
    assert.equal(obj.currentSuggestion, 'rot')
  })
})

describe('User Class', function () {
  const languages = ['en-au', 'en-en']
  const customWordsObject = { kablam: ['fr-fr'], shizzle: ['de-de', 'en-en'], colourful: ['en-au', 'en-gb'] }

  let dictionaries
  let enUser
  let deUser
  let deDict

  before(async function () {
    this.timeout(5000)
    const auDict = await loadDictionary('en-au')
    const amDict = await loadDictionary('en-en')
    deDict = await loadDictionary('de-de')
    dictionaries = [auDict, amDict]
    enUser = new User(dictionaries, languages, customWordsObject)
  })

  it('asserts object is instance of User', function () {
    assert.instanceOf(enUser, User)
  })

  it('asserts object.dicts is array of exactly 2 Dictionaries', function () {
    assert.instanceOf(enUser.dicts[0], Dictionary)
    assert.instanceOf(enUser.dicts[1], Dictionary)
    assert.lengthOf(enUser.dicts, 2, 'dicts has length of 2')
  })

  it('asserts object.langs is array of exactly 2 stings', function () {
    assert.typeOf(enUser.langs[0], 'string')
    assert.typeOf(enUser.langs[1], 'string')
    assert.lengthOf(enUser.langs, 2, 'langs has length of 2')
  })

  it('asserts object.spellers is array of exactly 2 nspell instances', function () {
    assert.instanceOf(enUser.spellers['en-au'], nspell.prototype.constructor)
    assert.instanceOf(enUser.spellers['en-en'], nspell.prototype.constructor)
    assert.lengthOf(Object.keys(enUser.spellers), 2, 'dicts has length of 2')
  })

  it('asserts that preferred language returns default (first) language when no matching locale found', function () {
    assert.equal(enUser.getPreferredLanguage('fr'), 'en-au')
  })

  it('asserts that preferred language returns correct language code upon matching a locale', function () {
    assert.equal(enUser.getPreferredLanguage('en'), 'en-au')
  })

  it('asserts that setting a new preferred language order with an unavailable language does not set that language as preferred', function () {
    enUser.setPreferredLanguageOrder(['fr-fr', 'en-au', 'en-en'])
    assert.equal(enUser.getPreferredLanguage('fr'), 'en-au')
  })

  it('asserts that setting a new preferred language order returns updated default (first) language when no matching locale found', function () {
    enUser.setPreferredLanguageOrder(['en-en', 'en-au'])
    assert.equal(enUser.getPreferredLanguage('fr'), 'en-en')
  })

  it('asserts that all custom words used to instantiate user are marked as correct in all current user languages', function () {
    assert.equal(enUser.spellers['en-au'].correct('kablam'), true, 'kablam correct in Australian English')
    assert.equal(enUser.spellers['en-au'].correct('shizzle'), true, 'shizzle correct in Australian English')
    assert.equal(enUser.spellers['en-au'].correct('colourful'), true, 'colourful correct in Australian English')
    assert.equal(enUser.spellers['en-en'].correct('kablam'), true, 'kablam correct in American English')
    assert.equal(enUser.spellers['en-en'].correct('shizzle'), true, 'shizzle correct in American English')
    assert.equal(enUser.spellers['en-en'].correct('colourful'), true, 'colourful correct in American English')
  })

  it('asserts that adding a word marks it as correct in all user languages', function () {
    enUser.addWord('snuckles')
    assert.equal(enUser.spellers['en-au'].correct('snuckles'), true, 'snuckles correct in Australian English')
    assert.equal(enUser.spellers['en-en'].correct('snuckles'), true, 'snuckles correct in American English')
  })

  it('asserts that removing a word marks it as incorrect in only those languages it is actually misspelt in', function () {
    enUser.removeWord('colourful')
    assert.equal(enUser.spellers['en-au'].correct('colourful'), true, 'colourful still correct in Australian English')
    assert.equal(enUser.spellers['en-en'].correct('colourful'), false, 'colourful incorrect in American English')
  })

  it('asserts that words are fixed if not properly added', function () {
    // see https://github.com/wooorm/nspell/issues/25
    this.timeout(5000)
    deUser = new User([deDict], ['de-de'], { zeit: [] })
    assert.equal(deUser.spellers['de-de'].correct('zeit'), true, 'zeit is correct in German')
  })

  it('asserts that removing a correctly spelt German word from a user\'s custom words does not throw an error', function () {
    deUser.addWord('Brot')
    assert.doesNotThrow(() => deUser.removeWord('Brot'), Error)
  })

  it('asserts that an error is thrown if language and dictionary length not equal', function () {
    assert.throws(() => new User(dictionaries, ['de-de', 'en-en', 'en-au'], { zeit: [] }), RangeError)
  })

  it('asserts that no error is thrown is user instantiated with an empty custom word array', function () {
    assert.doesNotThrow(() => new User(dictionaries, languages, []))
  })
})

describe('Word Class', function () {
  const content = 'Am I a real boy, or am I just fantasy?' // eslint-disable-line no-unused-vars

  const validWord = {
    word: 'fantasy',
    start: 30,
    end: 7
  }

  const invalidWord = {
    word: '',
    start: 28,
    end: 29
  }

  let obj

  it('asserts object is instance of Word', function () {
    obj = new Word(...Object.values(validWord))
    assert.instanceOf(obj, Word)
  })

  it('asserts object.isValid() returns true if word length greater than 0', function () {
    assert.equal(obj.isValid(), true, 'fantasy is a valid word')
  })

  it('asserts object is iterable and returns text, start, and end values in that exact order', function () {
    assert.sameOrderedMembers([...obj], ['fantasy', 30, 7], 'Iterable values in order and as expected')
  })

  it('asserts object.isValid() returns false if word is a 0 length string', function () {
    obj = new Word(...Object.values(invalidWord))
    assert.equal(obj.isValid(), false, 'The 0 length string: "" is an invalid word')
  })
})
