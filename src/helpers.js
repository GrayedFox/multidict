// remove the first instance of an item inside an array  (extends native array object)
if (!Array.prototype.remove) {
  Array.prototype.remove = function remove (item) { // eslint-disable-line no-extend-native
    if (!(this || Array.isArray(this))) {
      throw new TypeError()
    }

    if (this.includes(item) || this.indexOf(item) !== -1) {
      this.splice(this.indexOf(item), 1)
      return this
    }

    // handles cases where item is a finite index and element at given index is defined
    if (typeof this[item] !== 'undefined' && item >= 0 && Number.isFinite(item)) {
      this.splice(item, 1)
      return this
    }
  }
}

// custom async forEach function taken from p-iteration
async function asyncForEach (array, callback, thisArg) {
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

// make target mark element blink N times over M milliseconds by removing/adding class
function blinkMark (mark, color, times, milliseconds) {
  const tempInterval = setInterval(() => {
    const classList = mark.classList
    classList.contains((color)) ? classList.remove(color) : classList.add(color)
  }, Math.round(milliseconds / times))

  setTimeout(() => {
    clearInterval(tempInterval)
    mark.classList.add('red')
  }, milliseconds)
}

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

// helper function that creates an element and adds classes
function createClassyElement (type, classes) {
  const element = document.createElement(type)
  classes.forEach((klass) => element.classList.add(klass))
  return element
}

// create Add and Remove multdict context menu items
function createMenuItems () {
  browser.menus.create({
    id: 'add',
    type: 'normal',
    title: 'Add word to personal dictionary',
    contexts: ['selection'],
    icons: { 16: 'media/icons/plus-icon.svg' }
  })

  browser.menus.create({
    id: 'remove',
    type: 'normal',
    title: 'Remove word from personal dictionary',
    contexts: ['selection'],
    icons: { 16: 'media/icons/minus-icon.svg' }
  })
}

// jQuery like helper function for getting/setting property values or computed styles of an element
// pass an object as 2nd param to set styles, or an array as 2nd param to get them
// 3rd param dictates whether to get computed styles or not (defaults to false)
function css (element, styles, computedStyles = false) {
  if (Array.isArray(styles)) {
    const requestedStyles = {}
    styles.forEach((style) => {
      if (!computedStyles) {
        requestedStyles[style] = element.getPropertyValue(style)
      } else {
        const win = element.ownerDocument.defaultView
        requestedStyles[style] = win.getComputedStyle(element, null)[style]
      }
    })
    return requestedStyles
  } else {
    for (const [key, value] of Object.entries(styles)) {
      element.style[key] = value
    }
    return element
  }
}

// sexy es6 debounce with spread operator
function debounce (callback, wait) {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(function () { callback.apply(this, args) }, wait)
  }
}

// take a single node, nodeList, or array of nodes and disables native spell checking
function disableNativeSpellcheck (nodeList) {
  if (!Array.isArray(nodeList)) {
    nodeList = Array.from(nodeList)
  }
  nodeList.forEach((node) => node.setAttribute('spellcheck', false))
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

      if (!isWordBoundary(prevChar)) {
        boundaries.start--
      }

      if (!isWordBoundary(nextChar)) {
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

// generate a css selector of a given node
function getCssSelector (node) {
  const path = []
  let parent
  while (parent = node.parentNode) { // eslint-disable-line no-cond-assign
    path.unshift(`${node.tagName}:nth-child(${[].indexOf.call(parent.children, node) + 1})`)
    node = parent
  }
  return `${path.join(' > ')}`.toLowerCase()
};

// get properties based on domain (i.e. github)
function getDomainSpecificProps (hostname, properties, textarea) {
  switch (hostname) {
    case 'github.com':
      properties.display = 'block'
      break
    default:
      if (properties.display === 'inline' || properties.display === 'inline-block') {
        properties.display = 'inline-flex'
      } else {
        properties.display = 'flex'
        properties.width = `${textarea.offsetWidth}px`
      }
  }

  return properties
}

// gets the index of a Word by matching the Word boundaries against the chunk of text being
// operated on (needed for when duplicate misspelt words appear inside content)
function getMatchingMarkIndex (content, word) {
  if (!word.isValid() || !content) {
    return
  }

  let searchIndex = 0
  let wordIndex = 0
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
          wordIndex++
        }
      }
    } else {
      console.warn('MultiDict: could not find matching mark index inside given content!')
      break
    }
  }
  return wordIndex
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
// selection are relative to the text within the specified node
function getSelectionBounds (node) {
  // textareas are easy - just return the selectionStart and selectionEnd properties
  if (node.nodeName === 'TEXTAREA') {
    return { start: node.selectionStart, end: node.selectionEnd }
  }

  const selection = window.getSelection()
  // needed for when adding/removing custom words from non-textareas i.e. divs
  if (selection.toString().length > 0) {
    const text = selection.toString()
    const word = cleanWord(text)
    return [word, ...getRelativeBounds(word, text, node.selectionStart)]
  }
}

// get current text boundaries based on node start and end if defined and not equal, otherwise
// get boundaries based off the caret positioned at the start/end/within a text node, otherwise
// use window selection if present
function getCurrentWordBounds (node) {
  const content = node.value || node.innerText
  const selection = getSelectionBounds(node)

  // selection is not collapsed if start and end not equal
  if (selection.start !== selection.end) {
    const word = content.slice(selection.start, selection.end)
    console.log('word', word)
    return [word, ...getRelativeBounds(word, content, selection.start)]
  }

  // prefer using getWordBoundsFromCaret over window selection
  if (selection.start >= 0) {
    return getWordBoundsFromCaret(node, content, selection.start)
  }

  console.warn('MultiDict: get selected word boundaries failed to find any workable text.')
}

// conditionally return the text content of a node (including line breaks) based on node type
function getTextContent (node, hostname) {
  return node.nodeName === 'TEXTAREA'
    ? node.value
    : node.innerText
}

// return a boolean value that is true if the domain/page is supported, element name matches
// supported types
function isSupported (node, location) {
  const supportedDomains = [''] // fill with supported domains later
  const hostname = location.hostname

  if (node.nodeName === 'TEXTAREA') {
    return true
  }

  if (node.nodeName === 'DIV' && node.isContentEditable) {
    return supportedDomains.includes(hostname) ||
      (hostname === '' && location.protocol === 'file:') // support local files for testing
  }

  return false
}

// return a boolean value that is true if a word, based on the content and startIndex, is a whole
// word i.e. isWholeWord('lumber', 'he slumbers', 4) would return false
function isWholeWord (word, content, start) {
  const prevChar = content.charAt(start - 1)
  const nextChar = content.charAt(start + word.length)
  return isWordBoundary(prevChar) && isWordBoundary(nextChar)
}

// return a boolean value that checks whether or not a character is a word boundary
// if char matches any separators, is undefined, or is a zero length string we return true
function isWordBoundary (char) {
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

// load local dictionary files from supported languages based on user prefs (acceptLanguages)
function loadDictionariesAndPrefs (languages) {
  // ToDo: check if this negatively impacts memory imprint (may need to fetch dict/aff files)
  const dicts = []
  let prefs = []
  return asyncForEach(languages, async (language) => {
    const dic = await readTextFile(browser.runtime.getURL(`./dictionaries/${language}.dic`))
    const aff = await readTextFile(browser.runtime.getURL(`./dictionaries/${language}.aff`))
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

// read a text file, the firefox extension way
function readTextFile (path) {
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

// replace Word inside of content with replacement by using the Word's boundaries
function replaceInText (content, word, replacement) {
  return `${content.slice(0, word.start)}${replacement}${content.slice(word.end)}`
}

// return new settings object based on settingsArray
function updateSettingsObject (settingsArray) {
  const settings = {}
  settingsArray.forEach((setting) => {
    settings[setting.split('-')[0]] = (setting.split('-')[1] === 'true')
  })
  return settings
}

module.exports = {
  blinkMark,
  cleanText,
  cleanWord,
  createClassyElement,
  createMenuItems,
  css,
  debounce,
  disableNativeSpellcheck,
  getCssSelector,
  getCurrentWordBounds,
  getDomainSpecificProps,
  getMatchingMarkIndex,
  getRelativeBounds,
  getSelectionBounds,
  getTextContent,
  isSupported,
  isWholeWord,
  loadDictionariesAndPrefs,
  prepareLanguages,
  replaceInText,
  updateSettingsObject
}
