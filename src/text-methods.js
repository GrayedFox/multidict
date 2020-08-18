/**
 * Text methods
 * @namespace TextMethods
 */

/**
 * Cleans text and strips out unwanted symbols/patterns.
 *
 * @memberof TextMethods
 * @param  {string} content - the chunk of text we will be operating on
 * @param  {boolean} [filterChars=true] - whether or not we want to filter out single characters
 * @returns {string[]} An array of cleaned text (tokens) we consider to be spell checkable
 */
function cleanText (content, filterChars = true) {
  if (!content || typeof content !== 'string') {
    console.warn(`Multidict: cannot clean falsy, undefined, or non-string content: "${content}"`)
    return []
  }

  const rxUrls = /(http:\/\/|https:\/\/|ftp:\/\/|www.)/
  // TODO: at some point look into using /[^\p{L}'-]/u which uses unicode ranges to match anything
  // that is not a valid letter, hyphen, or apostrophe
  const rxSeparators = /[.,:;!?¿_<>{}()[\]"`´^$°§½¼³%&¬+=*~#|/\\]/
  const rxSingleQuotes = /^'+|'+$/g

  // split all content by spaces, or new lines, our safest delimiters
  return content.split(/[\s\r\n]/)
    // filter out any URLS and emails
    .filter(string => !rxUrls.test(string) && !string.includes('@'))
    // split all content by any character that does not form part of a word
    .flatMap(string => string.split(rxSeparators))
    .reduce((acc, string) => {
      // remove any number of single quotes that do not form part of a word i.e. 'y'all' > y'all
      string = string.replace(rxSingleQuotes, '')
      // we never want empty strings, so skip them
      if (string.length < 1) { return acc }
      // filter out single characters
      if (string.length === 1 && filterChars) { return acc }
      // filter out strings that are pure numbers
      if (isNaN(string)) { return acc.concat([string]) }
      // return accumulator without changing/operating on the current current string
      return acc
    }, [])
}

/**
 * A wrapper around cleanText that doesn't filter out characters and returns only the first result
 * of the cleaned content.
 *
 * @memberof TextMethods
 * @see cleanText
 * @param  {string} content - the chunk of text to operate i.e. '100 bouncy balls'
 * @returns {string} The first valid word i.e. 'bouncy'
 */
function cleanWord (content) {
  return cleanText(content, false)[0]
}

/**
 * Gets the exact mark that we will use to insert word suggestions based on a known index. The index
 * is relative to how many times the misspelt word appears inside the highlighter.
 *
 * @memberof TextMethods
 * @param  {string} misspeltWord - the misspelt word the mark is positioned over
 * @param  {number} index - the relative index of the misspelt word if it appears more than once
 * @param  {node} highlights - the node containing the highlights (child nodes) we will be searching
 * @returns {Node} The currently focused mark according to a known relative index
 */
function getCurrentMark (misspeltWord, index, highlights) {
  return [...highlights.children].reduce((acc, child) => {
    return child.textContent === misspeltWord ? acc.concat([child]) : acc
  }, [])[index]
}

/**
 * Get current word bounds based on selection (if selection present) or get boundaries based on the
 * current caret position within a text node
 *
 * @memberof TextMethods
 * @param  {node} node - the node to operate on
 * @returns {Array} An array containing the word, start index, and end index i.e. ['boom', 0, 3]
 */
function getCurrentWordBounds (node) {
  const content = getTextContent(node)
  const selection = getSelectionBounds(node)

  // selection is not collapsed if start and end not equal
  if (selection.start !== selection.end) {
    const word = content.slice(selection.start, selection.end)
    return [word, ...getRelativeBounds(word, content, selection.start)]
  }

  // use getWordBoundsFromCaret to ensure we return current word
  return getWordBoundsFromCaret(node, content, selection.start)
}

/**
 * Get the relative index of a Mark by matching the Word boundaries against the chunk of text being
 * spellchecked. This is needed for when duplicate misspelt words appear inside of a textarea. The
 * matching mark index is based on the Word boundaries, since a Word always has start and end values
 * relative to where it appears inside of the content it was created from.
 *
 * @memberof TextMethods
 * @param  {string} content - the chunk of text we will operate on
 * @param  {Word} word - the Word we are searching for
 * @returns {number} An index representing the exact position of a word inside content
 */
function getMatchingMarkIndex (content, word) {
  if (!word.isValid() || !content) {
    console.warn('Multidict: cannot get mark index of undefined content or invalid word')
    return -1
  }

  let searchIndex = 0
  let markIndex = 0
  let found = false

  while (!found) {
    searchIndex = content.indexOf(word.text, searchIndex)
    if (searchIndex !== -1) {
      const start = searchIndex
      const end = searchIndex + word.length
      if (start === word.start && end === word.end) {
        found = true
      } else {
        searchIndex += word.length
        // don't update markIndex unless we've matched a whole word
        if (isWholeWord(word.text, content, start)) {
          markIndex++
        }
      }
    } else {
      console.warn('Multidict: could not find matching mark index inside given content!')
      return -1
    }
  }
  return markIndex
}

/**
 * Get the relative boundaries of a word given a specific start index
 *
 * @memberof TextMethods
 * @param  {string} word - the word we are searching for within content
 * @param  {string} content - the chunk of text being operated on
 * @param  {number} startIndex - the index from where to begin searching content from
 * @returns {Array|undefined} An array containing the start and end bounds of a word or undefined
 * if word or content undefined
 */
function getRelativeBounds (word, content, startIndex = 0) {
  if (!word || !content || content.indexOf(word, startIndex) === -1) {
    console.warn(`Multidict: cannot get relative boundaries of ${word} in ${content}`)
    return
  }
  const start = content.indexOf(word, startIndex)
  return [start, start + word.length]
}

/**
 * Get the selection boundaries of a given node. For now only supports textareas.
 *
 * @memberof TextMethods
 * @param  {Node} node - the node we will operate on
 * @returns {Object} An object with start and end parameters or an empty object if node is not
 * supported
 */
function getSelectionBounds (node) {
  if (node.nodeName !== 'TEXTAREA') {
    console.warn('Multidict: can only get selection bounds of textareas')
    return {}
  }
  return { start: node.selectionStart, end: node.selectionEnd }
}

/**
 * Conditionally return the text content of a node (including line breaks) based on the node type.
 *
 * @memberof TextMethods
 * @param  {Node} node - the node we will operate on
 * @returns {string} The text content (including line breaks) of the node
 */
function getTextContent (node) {
  return node.nodeName === 'TEXTAREA'
    ? node.value
    : node.innerText || node.textContent
}

/**
 * Gets the currently focused word and it's boundaries based on caret position.
 *
 * @memberof TextMethods
 * @param  {Node} node - the node we will operate on
 * @param  {string} text - the text content used to generate a word selection from
 * @param  {number} startIndex - the index from where we will begin building our word
 * @returns {Array} An array containing the word, start index, and end index
 */
function getWordBoundsFromCaret (node, text, startIndex) {
  if (!(startIndex >= 0)) {
    console.warn('Multidict: cannot get current word boundaries if start index negative')
    return ['']
  }

  const boundaries = {
    start: startIndex,
    end: startIndex
  }

  if (text) {
    let found = false
    while (!found) {
      const start = boundaries.start
      const end = boundaries.end
      const prevChar = text.charAt(start - 1)
      const nextChar = text.charAt(end)

      if (!_isWordBoundary(prevChar)) {
        boundaries.start--
      }

      if (!_isWordBoundary(nextChar)) {
        boundaries.end++
      }

      // if we haven't moved either boundary, we have our word
      if (start === boundaries.start && end === boundaries.end) {
        found = true
        if (start < end) {
          const word = cleanWord(text.slice(start, end))
          return [word, ...getRelativeBounds(word, text, start)]
        }
        // start and end can be equal if caret positioned between 2 word boundaries i.e. ' | '
        return ['', start, end]
      }
    }
  } else {
    // for an empty text box and unhandled cases we return no text, start and end 0
    return ['', 0, 0]
  }
}

/**
 * Search content for an exact match of the given word as of start (or elsewhere).
 *
 * @memberof TextMethods
 * @param  {string} word - the sequence of characters we are testing appears as a whole word
 * @param  {string} content - text content to be tested with regex
 * @param  {number} start - mandatory index that represents exactly where word begins inside content
 * @returns {boolean} True if a word appears at least once as a whole word (as of start)
 */
function isWholeWord (word, content, start) {
  const prevChar = content.charAt(start - 1)
  const nextChar = content.charAt(start + word.length)

  return _isWordBoundary(prevChar) && _isWordBoundary(nextChar)
}

/**
 * Check whether or not a character is a word boundary or not. If char matches any separators, is
 * undefined, or is a zero length string we return true
 *
 * @private
 * @memberof TextMethods
 * @param  {string} char - a one character length string
 * @returns {boolean} True if the char is undefined, a 0 length string, or matches is a word boundary
 */
function _isWordBoundary (char) {
  if (typeof char === 'undefined' || (typeof char === 'string' && char.length === 0)) {
    return true
  }

  const rxSeparators = /[\s\r\n.,:;!¿?_<>{}()[\]"`´^$°§½¼³%&¬+=*~#|/\\]/

  return rxSeparators.test(char)
}

/**
 * Replace a Word inside of content with replacement by using the Word's boundaries
 *
 * @memberof TextMethods
 * @param  {string} content - the content on which to operate on
 * @param  {Word} word - the Word we are going to replace
 * @param  {string} replacement - the string of text used to replace the Word
 * @returns {string} The modified content that has the replacement in place of the Word
 */
function replaceInText (content, word, replacement) {
  if (!replacement || typeof replacement !== 'string') {
    throw new TypeError('replacement must be of type string and have a value')
  }
  return `${content.slice(0, word.start)}${replacement}${content.slice(word.end)}`
}

/**
 * Used to store and then restore a previous selection/caret position.
 *
 * @memberof TextMethods
 * @param  {Node} node - a node that has start and end selection values
 * @returns {function(): undefined} The function that will be use to later restore the selection
 */
function storeSelection (node) {
  const storedSelection = getSelectionBounds(node)

  /**
   * Call this function to restore the previous selection range stored when calling storeSelection
   *
   * @memberof TextMethods
   */
  return function () {
    node.focus()
    node.setSelectionRange(storedSelection.start, storedSelection.end)
  }
}

module.exports = {
  cleanText,
  cleanWord,
  getCurrentMark,
  getCurrentWordBounds,
  getMatchingMarkIndex,
  getRelativeBounds,
  getTextContent,
  getSelectionBounds,
  getWordBoundsFromCaret,
  isWholeWord,
  replaceInText,
  storeSelection
}
