// cleans text and strips out unwanted symbols/patterns before we use it
// returns an empty string if content undefined
function cleanText (content, filter = true) {
  if (!content) {
    console.warn(`MultiDict: cannot clean falsy or undefined content: "${content}"`)
    return ''
  }

  // ToDo: first split string by spaces in order to properly ignore urls
  const rxUrls = /^(http|https|ftp|www)/
  const rxSeparators = /[\s\r\n.,:;!?_<>{}()[\]"`´^$°§½¼³%&¬+=*~#|/\\]/
  const rxSingleQuotes = /^'+|'+$/g

  // split all content by any character that should not form part of a word
  return content.split(rxSeparators)
    .reduce((acc, string) => {
      // remove any number of single quotes that do not form part of a word i.e. 'y'all' > y'all
      string = string.replace(rxSingleQuotes, '')
      // we never want empty strings, so skip them
      if (string.length < 1) {
        return acc
      }
      // for when we're just cleaning the text of punctuation (i.e. not filtering out emails, etc)
      if (!filter) {
        return acc.concat([string])
      }
      // filter out emails, URLs, numbers, and strings less than 2 characters in length
      if (!string.includes('@') && !rxUrls.test(string) && isNaN(string) && string.length > 1) {
        return acc.concat([string])
      }
      return acc
    }, [])
}

// for when we are cleaning text and only interested in the first result
function cleanWord (content) {
  return cleanText(content, false)[0]
}

// gets the exact mark that we will use when inserting a word carousel (showing suggestions) based
// on a known, specific index
function getCurrentMark (word, index, highlighter) {
  const highlights = highlighter.$highlighter.shadowRoot.querySelector('#highlights')
  return [...highlights.children].reduce((acc, child) => {
    return child.textContent === word ? acc.concat([child]) : acc
  }, [])[index]
}

// get current text boundaries based on node start and end if defined and not equal, otherwise
// get boundaries based off the caret positioned at the start/end/within a text node, otherwise
// use window selection if present
function getCurrentWordBounds (node) {
  const content = getTextContent(node)
  const selection = getSelectionBounds(node)

  // selection is not collapsed if start and end not equal
  if (selection.start !== selection.end) {
    const word = content.slice(selection.start, selection.end)
    return [word, ...getRelativeBounds(word, content, selection.start)]
  }

  // prefer using getWordBoundsFromCaret over window selection
  if (selection.start >= 0) {
    return getWordBoundsFromCaret(node, content, selection.start)
  }

  console.warn('MultiDict: get selected word boundaries failed to find any workable text.')
}

// gets the index of a Word by matching the Word boundaries against the chunk of text being
// operated on (needed for when duplicate misspelt words appear inside content)
function getMatchingMarkIndex (content, word) {
  if (!word.isValid() || !content) {
    return
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
        if (isWholeWord(word, content, start)) {
          markIndex++
        }
      }
    } else {
      console.warn('MultiDict: could not find matching mark index inside given content!')
      break
    }
  }
  return markIndex
}

// gets the index of the misspelt word used to generate the Carousel
// if the misspelt word occurs more than once the reduced array will contain multiple entries
// requiring the position of the misspelt word dupe (duplicateWordIndex) to be known before hand
function getMisspeltWordIndex (misspeltWord, duplicateWordIndex = 0) {
  return this.spelling.misspeltWords.reduce((acc, word, misspeltWordIndex) => {
    return word.text === misspeltWord ? acc.concat([misspeltWordIndex]) : acc
  }, [])[duplicateWordIndex]
}

// get the relative boundaries of a word given a specific start index within content
function getRelativeBounds (word, content, startIndex) {
  if (!word) {
    console.warn(`MultiDict: cannot get relative boundaries of ${word}`)
    return
  }
  const start = content.indexOf(word, startIndex)
  return [start, start + word.length]
}

// get selection boundaries of any currently selected text - the start and end bounds of the
function getSelectionBounds (node) {
  // textareas are easy - just return the selectionStart and selectionEnd properties
  if (node.nodeName === 'TEXTAREA') {
    return { start: node.selectionStart, end: node.selectionEnd }
  }
}

// conditionally return the text content of a node (including line breaks) based on node type
function getTextContent (node) {
  return node.nodeName === 'TEXTAREA'
    ? node.value
    : node.innerText
}

// gets the current word and it's boundaries based on cursor position/selection
function getWordBoundsFromCaret (node, text, startIndex) {
  if (!(startIndex >= 0)) {
    console.warn('MultiDict: cannot get current word boundaries if start index negative')
    return ''
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
 * isWholeWord - searches the text content for an exact match of the given word from the
 * beginning (or elsewhere) of the string. Returns false given the following inputs:
 * isWholeWord('Shorts and sweets', 'sweet')     -- sweet does not appear as a whole word
 * isWholeWord('Shorts and sweets', 'Shorts', 1) -- search begins at h so no match
 *
 * @param  {string} word - The sequence of characters we are testing appears as a whole word
 * @param  {string} content - Text content to be tested with regex
 * @param  {number=0} start - Optional index to begin searching content from
 * @returns {boolean} - True if a word appears at least once as a whole word (as of start)
 */

function isWholeWord (word, content, start = 0) {
  const rxWordBounds = new RegExp(`\\b${word}\\b`)
  return rxWordBounds.test(content.slice(start))
}

// return a boolean value that checks whether or not a character is a word boundary
// if char matches any separators, is undefined, or is a zero length string we return true
function _isWordBoundary (char) {
  if (typeof char === 'undefined' || (typeof char === 'string' && char.length === 0)) {
    return true
  }

  if (char.length !== 1) {
    console.warn(`MultiDict: word boundary can only operate on single characters! Not: "${char}"`)
    return
  }

  const rxSeparators = /[\s\r\n.,:;!?_<>{}()[\]"`´^$°§½¼³%&¬+=*~#|/\\]/

  return rxSeparators.test(char)
}

// replace Word inside of content with replacement by using the Word's boundaries
function replaceInText (content, word, replacement) {
  return `${content.slice(0, word.start)}${replacement}${content.slice(word.end)}`
}

// used to restore a previous selection/cursor position
function storeSelection (selection) {
  const storedSelection = selection

  return function (textarea) {
    textarea.focus()
    textarea.setSelectionRange(storedSelection.start, storedSelection.end)
  }
}

module.exports = {
  cleanText,
  cleanWord,
  getCurrentMark,
  getCurrentWordBounds,
  getMatchingMarkIndex,
  getMisspeltWordIndex,
  getRelativeBounds,
  getTextContent,
  getSelectionBounds,
  getWordBoundsFromCaret,
  isWholeWord,
  replaceInText,
  storeSelection
}
