const { Word } = require('./classes.js')

// remove the first instance of an item inside an array  (extends native array object)
if (!Array.prototype.remove) {
  Array.prototype.remove = function remove (item) { // eslint-disable-line no-extend-native
    if (!(this || Array.isArray(this))) {
      throw new TypeError()
    }

    if (this.includes(item)) {
      this.splice(this.indexOf(item), 1)
      return this
    }
  }
}

// custom async forEach function taken from p-iteration
async function _forEach (array, callback, thisArg) {
  const promiseArray = []
  for (let i = 0; i < array.length; i++) {
    if (i in array) {
      const p = Promise.resolve(array[i]).then((currentValue) => {
        return callback.call(thisArg || this, currentValue, i, array)
      })
      promiseArray.push(p)
    }
  }
  await Promise.all(promiseArray)
}

// get the relative boundaries of a word given a specific start index within content
function _getRelativeBoundaries (word, content, startIndex) {
  if (!word) {
    console.warn(`MultiDict: cannot get relative boundaries of ${word}`)
    return
  }
  const start = content.indexOf(word, startIndex)
  return [start, start + word.length]
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

// read a text file, the firefox extension way
function _readTextFile (path) {
  return new Promise((resolve, reject) => {
    fetch(path, { mode: 'same-origin' })
      .then(function (res) {
        return res.blob()
      })
      .then(function (blob) {
        const reader = new FileReader()

        reader.addEventListener('loadend', function () {
          resolve(this.result)
        })

        reader.readAsText(blob)
      })
      .catch(error => {
        resolve({ error: error })
      })
  })
}

// create Add and Remove multdict context menu items
function createMenuItems () {
  browser.contextMenus.create({
    id: 'add',
    type: 'normal',
    title: 'Add word to personal dictionary',
    contexts: ['selection'],
    icons: { 16: '/icons/plus-icon.svg' }
  })

  browser.contextMenus.create({
    id: 'remove',
    type: 'normal',
    title: 'Remove word from personal dictionary',
    contexts: ['selection'],
    icons: { 16: '/icons/minus-icon.svg' }
  })
}

// sexy es6 debounce with spread operator
function debounce (callback, wait) {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(function () { callback.apply(this, args) }, wait)
  }
}

// return a boolean value that is true if a word, based on the content and startIndex, is a whole
// word i.e. isWholeWord('lumber', 'he slumbers', 4) would return false
function isWholeWord (word, content, start) {
  const prevChar = content.charAt(start - 1)
  const nextChar = content.charAt(start + word.length)
  return _isWordBoundary(prevChar) && _isWordBoundary(nextChar)
}

// cleans text and strips out unwanted symbols/patterns before we use it
// returns an empty string if content undefined
function cleanText (content, filter = true) {
  if (!content) {
    console.warn(`MultiDict: cannot clean falsy or undefined content: "${content}"`)
    return ''
  }

  const rxUrls = /^(http|ftp|www)/
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

// gets the current word based on cursor position
function getCurrentWord (node) {
  if (!(node.selectionStart >= 0)) {
    console.warn('MultiDict: get current word failed to find a caret position')
    return ''
  }

  const boundaries = {
    start: node.selectionStart,
    end: node.selectionStart
  }

  const text = node.value
  if (text) {
    let i = 0
    while (i < 1) {
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
        i = 1
        if (start < end) {
          const word = cleanWord(text.slice(start, end))
          return new Word(word, ..._getRelativeBoundaries(word, text, start))
        }
        // start and end can be equal if caret positioned between 2 word boundaries i.e. ' | '
        return new Word('', start, end)
      }
    }
  }
}

// use window selection if present, else the current node selection if selection start and end not
// equal, otherwise get a selection based off the caret positioned at the start/end/within a node
function getSelectedWord (node = document.activeElement) {
  const selection = {
    start: node.selectionStart,
    end: node.selectionEnd
  }

  if (window.getSelection().toString().length > 0) {
    const text = window.getSelection().toString()
    const word = cleanWord(text)
    return new Word(word, ..._getRelativeBoundaries(word, text, selection.start))
  }

  if (selection.start !== selection.end) {
    const text = node.value.slice(selection.start, selection.end)
    const word = cleanWord(text)
    return new Word(word, ..._getRelativeBoundaries(word, text, selection.start))
  }

  if (node.selectionStart >= 0) {
    return getCurrentWord(node)
  }

  console.warn('MultiDict: get current selection failed to find any workable text.')
}

// load local dictionary files from supported languages based on user prefs (acceptLanguages)
function loadDictionariesAndPrefs (languages) {
  const dicts = []
  let prefs = []
  return _forEach(languages, async (language) => {
    const dic = await _readTextFile(browser.runtime.getURL(`./dictionaries/${language}.dic`))
    const aff = await _readTextFile(browser.runtime.getURL(`./dictionaries/${language}.aff`))
    if (!dic.error && !aff.error) {
      prefs.push(language)
      dicts.push({ language, dic, aff })
    }
  }).then(function () {
    // trim first three characters of supported langauges i.e. en-gb > gb
    prefs = prefs.reduce((acc, lang) => acc.concat([lang.slice(3, 5)]), [])
    return { dicts, prefs }
  }).catch(function (err) {
    console.error(err)
  })
}

// prepares a language array from the browser accept languages
function prepareLanguages (languages) {
  return languages.reduce((acc, language, index) => {
    // if we come accross a language code without a locale, use the language as the locale
    if (language.length === 2) {
      language += `-${language}`
      languages[index] = language
    }
    // do not add duplicate languages to language array
    if (languages.indexOf(language) === index) {
      return [...acc, language]
    }
    return acc
  }, [])
}

module.exports = {
  cleanText,
  cleanWord,
  createMenuItems,
  debounce,
  getCurrentWord,
  getSelectedWord,
  isWholeWord,
  loadDictionariesAndPrefs,
  prepareLanguages
}
