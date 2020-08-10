const { assert } = require('chai')
const textMethods = require('../src/text-methods')

describe('Text Methods: Cleaning Text', function () {
  const { cleanText, cleanWord } = textMethods
  const content = 'I am test content y\'all! test@email.de \'available\' at "www.youdaman.io" or c +49 (030) 1178 221 call today? :) "_" "\r" ".,:;!?¿_<>{}()[]"`´^$°§½¼³%&¬+=*~#|/\\"'
  const cleanedContent = cleanText(content)

  it('should assert that cleanText() returns an empty array if content is falsy', function () {
    const emptyStringResult = cleanText('')
    const numZeroResult = cleanText(0)
    const emptyArgsResult = cleanText()

    assert.isArray(emptyStringResult)
    assert.isEmpty(emptyStringResult, 'Empty array returned on 0 length string')
    assert.isArray(numZeroResult)
    assert.isEmpty(numZeroResult, 'Empty array returned when passing 0 as arg')
    assert.isArray(emptyArgsResult)
    assert.isEmpty(emptyArgsResult, 'Empty array returned when no args given')
  })

  it('should assert that cleanText() returns an array of strings only', function () {
    assert.typeOf(cleanedContent, 'array')
    cleanedContent.every(x => assert.typeOf(x, 'string'))
  })

  it('should assert that cleanText() strips URLs', function () {
    cleanedContent.every(x => assert.notMatch(x, /(http:\/\/|https:\/\/|ftp:\/\/|www.)/))
    assert.notInclude(cleanedContent, 'www.youdaman.io')
  })

  it('should assert that emails are stripped out of the cleaned text', function () {
    cleanedContent.every(x => assert.notInclude(x, '@'))
    assert.notInclude(cleanedContent, 'test@email.de')
  })

  it('should assert that cleanText() strips out single quotes if they do not form part of a word', function () {
    assert.include(cleanedContent, 'available')
    assert.include(cleanedContent, 'y\'all')
  })

  it('should assert that cleanText() strips out all punctuation of cleaned text', function () {
    cleanedContent.every(x => assert.notMatch(x, /[.,:;!?¿_<>{}()[\]"`´^$°§½¼³%&¬+=*~#|/\\]/))
  })

  it('should assert that cleanText() strips out 0 length strings', function () {
    cleanedContent.every(x => assert.notMatch(x, /[\s\r\n]/))
  })

  it('should assert that cleanText() strips out numbers', function () {
    cleanedContent.every(x => assert.equal(isNaN(x), true))
  })

  it('should assert that cleanText() strips out characters if filterChars is true', function () {
    cleanText(content, true).every(x => assert.isAbove(x.length, 1))
  })

  it('should assert that cleanText() does not strip out characters if filterChars is false', function () {
    assert.equal(cleanText(content, false).some(x => x.length, 1), true)
  })

  it('should assert that cleanWord() does not strip out characters', function () {
    assert.equal(cleanWord(content), 'I')
  })

  it('should assert that cleanWord() returns a string', function () {
    assert.typeOf(cleanWord(content), 'string')
  })
})

describe('Text Methods: Word and Selection Boundaries', function () {
  const {
    getCurrentWordBounds, getRelativeBounds, getSelectionBounds, getTextContent,
    getWordBoundsFromCaret, isWholeWord, storeSelection
  } = textMethods
  const { getDom, nodeFactory } = require('./factory')
  const content = 'The [] cherry-pudding text is in the pudding.'
  const word = 'pudding'

  let textarea
  let div
  let dom

  before(function () {
    dom = getDom()
    textarea = nodeFactory('<textarea id="texty">The [] cherry-pudding text is in the pudding.</textarea>')
    div = nodeFactory('<div>hello</div>')
  })

  it('should assert that getSelectionBounds() returns an empty object if node is not a textarea', function () {
    const result = getSelectionBounds(div)

    assert.isObject(result, 'result from passing div is an object')
    assert.isEmpty(result, 'result from passing div is empty')
  })

  it('should assert that getSelectionBounds() has start and end properties when passing a textarea', function () {
    const result = getSelectionBounds(textarea)

    assert.property(result, 'start')
    assert.property(result, 'end')
  })

  it('should assert that getRelativeBounds() returns undefined if word or content are falsy', function () {
    assert.isUndefined(getRelativeBounds('', content), 'Undefined if word is empty string')
    assert.isUndefined(getRelativeBounds(word, ''), 'Undefined if content is empty string')
  })

  it('should assert that getRelativeBounds() returns undefined if word cannot be found within content', function () {
    assert.isUndefined(getRelativeBounds('kablam', content), 'Undefined if word cannot be found within content')
  })

  it('should assert that getRelativeBounds() returns the correct relative boundaries of the given word instance', function () {
    assert.equal(content.substring(...getRelativeBounds(word, content)), word)
    assert.sameMembers(getRelativeBounds(word, content), [14, 21])
  })

  it('should assert that getRelativeBounds() returns the correct relative boundaries of a word based on initial startIndex', function () {
    assert.equal(content.substring(...getRelativeBounds(word, content, 15)), word)
    assert.sameMembers(getRelativeBounds(word, content, 15), [37, 44])
  })

  it('should assert that getWordBoundsFromCaret() returns an array with an empty string if startIndex negative', function () {
    assert.sameMembers(getWordBoundsFromCaret(textarea, content, -2), [''])
  })

  it('should assert that getWordBoundsFromCaret() returns an array with an empty string and equal start and end values if caret positioned between two word boundaries', function () {
    assert.sameMembers(getWordBoundsFromCaret(textarea, content, 5), ['', 5, 5])
    assert.sameMembers(getWordBoundsFromCaret(textarea, content, 45), ['', 45, 45])
  })

  it('should assert that getWordBoundsFromCaret() returns an array with an empty string and start and end values of 0 if text falsy', function () {
    assert.sameMembers(getWordBoundsFromCaret(textarea, null, 5), ['', 0, 0])
    assert.sameMembers(getWordBoundsFromCaret(textarea, undefined, 5), ['', 0, 0])
    assert.sameMembers(getWordBoundsFromCaret(textarea, 0, 5), ['', 0, 0])
  })

  it('should assert that getWordBoundsFromCaret() returns correct word boundaries of the given caret position', function () {
    assert.sameMembers(getWordBoundsFromCaret(textarea, content, 10), ['cherry-pudding', 7, 21])
    assert.sameMembers(getWordBoundsFromCaret(textarea, content, 14), ['cherry-pudding', 7, 21])
    assert.sameMembers(getWordBoundsFromCaret(textarea, content, 43), ['pudding', 37, 44])
  })

  it('should assert that isWholeWord() returns true if word and content are identical', function () {
    assert.equal(isWholeWord(word, word), true)
  })

  it('should assert that isWholeWord() returns false if word and appears as part of another word', function () {
    assert.equal(isWholeWord('cherry', content), false)
  })

  it('should assert that isWholeWord() returns false if word and does not appear inside content', function () {
    assert.equal(isWholeWord('fridgetastic', content), false)
  })

  it('should assert that isWholeWord() returns true if word appears as a whole word but start index is greater than where word appears', function () {
    assert.equal(isWholeWord('text', content, 26), false)
  })

  it('should assert that getTextContent() returns correct content for textareas', function () {
    assert.equal(getTextContent(textarea), content)
  })

  it('should assert that getTextContent() returns correct content for divs', function () {
    assert.equal(getTextContent(div), 'hello')
  })

  it('should assert that getCurrentWordBounds() returns empty string with start and end values equal to length of string if selectionStart is negative', function () {
    textarea.selectionStart = -1
    assert.sameMembers(getCurrentWordBounds(textarea), ['', 45, 45])
  })

  it('should assert that getCurrentWordBounds() returns correct boundaries when selection start and end not equal', function () {
    textarea.setSelectionRange(7, 13)
    assert.sameMembers(getCurrentWordBounds(textarea), ['cherry', 7, 13])
  })

  it('should assert that getCurrentWordBounds() returns correct boundaries when selection start and end are equal', function () {
    textarea.setSelectionRange(10, 10)
    assert.sameMembers(getCurrentWordBounds(textarea), ['cherry-pudding', 7, 21])
  })

  it('should assert that storeSelection() sets correct selection and focuses text area after restoring', function () {
    const restoreSelection = storeSelection(textarea)
    div.focus()
    textarea.setSelectionRange(1, 22)
    restoreSelection()
    assert.sameMembers([textarea.selectionStart, textarea.selectionEnd], [10, 10], 'Selection range restored')
    assert.equal(dom.window.document.activeElement.id, 'texty', 'textarea has focus')
  })
})

describe('Text Methods: Location and Replacement', function () {
  const { getCurrentMark, getMatchingMarkIndex, replaceInText } = textMethods
  const { nodeFactory } = require('./factory')
  const { Word } = require('../src/classes')

  const content = 'lemony-snicket? lemony! lemony.'
  const word1 = new Word('lemony-snicket', 0, 14)
  const word2 = new Word('lemony', 16, 22)
  const word3 = new Word('lemony', 24, 30)

  let highlights

  before(function () {
    highlights = nodeFactory('<div><h2>lemony-snicket</h2>?<mark>lemony</mark>!<p>lemony</p>.</div>')
  })

  it('should assert that replaceInText() replaces correct word', function () {
    assert.equal(replaceInText(content, word2, 'bat-wizard'), 'lemony-snicket? bat-wizard! lemony.')
  })

  it('should assert that replaceInText() throws TypeError if content is null', function () {
    assert.throws(() => replaceInText(null, word2, 'kablam'), TypeError)
  })

  it('should assert that replaceInText() throws TypeError if word is undefined', function () {
    assert.throws(() => replaceInText(content, undefined, 'kablam'), TypeError)
  })

  it('should assert that replaceInText() throws TypeError if replacement is empty string', function () {
    assert.throws(() => replaceInText(content, word2, ''), TypeError)
  })

  it('should assert that getCurrentMark() returns correct mark based on known index', function () {
    assert.deepEqual(getCurrentMark('lemony', 0, highlights), highlights.children[1])
    assert.notDeepEqual(getCurrentMark('lemony', 1, highlights), highlights.children[1])
  })

  it('should assert that getCurrentMark() throws TypeError if highlights undefined', function () {
    assert.throws(() => getCurrentMark('lemony', 2, undefined))
  })

  it('should assert that getCurrentMark() returns undefined index negative', function () {
    assert.isUndefined(getCurrentMark('lemony', -1, highlights))
  })

  it('should assert that getCurrentMark() returns undefined if word cannot be found', function () {
    assert.isUndefined(getCurrentMark('poops', 0, highlights))
  })

  it('should assert that getMatchingMarkIndex() returns correct index', function () {
    assert.strictEqual(getMatchingMarkIndex(content, word1), 0)
  })

  it('should assert that getMatchingMarkIndex() returns -1 if word not found', function () {
    assert.strictEqual(getMatchingMarkIndex(content, new Word('fizbang', 0, 7)), -1)
  })

  it('should assert that getMatchingMarkIndex() returns -1 if content undefined or word is invalid', function () {
    assert.strictEqual(getMatchingMarkIndex(undefined, word2), -1)
    assert.strictEqual(getMatchingMarkIndex(content, new Word('', 0, 0)), -1)
  })

  it('should assert that getMatchingMarkIndex() returns correct index even if word appears inside another word', function () {
    assert.strictEqual(getMatchingMarkIndex(content, word2), 0)
    assert.strictEqual(getMatchingMarkIndex(content, word3), 1)
  })
})
