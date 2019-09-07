(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const messageHandler = browser.runtime.connect({ name: 'spell-checker' })
const editableFields = ['TEXTAREA']
const { debounce, getText } = require('./helpers.js')
const { highlight } = require('./deps/highlight/highlight.js')

let node

// catches the keyup event on editable fields
// TODO: don't spell check code or other inline editors
async function editable (event) {
  node = event.target

  // only detect language and spellcheck editable fields
  if (!editableFields.includes(node.nodeName) || node.contentEditable === false) {
    return
  }

  const content = getText(node)
  const detectedLanguage = await browser.i18n.detectLanguage(content)

  if (detectedLanguage.isReliable) {
    messageHandler.postMessage({
      name: 'spell-checker',
      language: detectedLanguage.languages[0].language,
      content: content
    })
  } else {
    messageHandler.postMessage({
      name: 'spell-checker',
      language: 'unreliable',
      content: content
    })
  }
}

// background script message object should contain: { spelling, node }
messageHandler.onMessage.addListener((message) => {
  if (message.greeting) {
    console.log(message.greeting)
  }
  if (message.spelling) {
    highlight(node, {
      highlight: message.spelling.misspeltWords,
      className: 'blue'
    })
  }
})

// mostly for debugging
messageHandler.onDisconnect.addListener((p) => {
  if (p.error) {
    console.warn(`MultiDict disconnected due to an error: ${p.error.message}`)
  }
})

// TODO: tie click/hover event to showing suggested words instead of spell checking
document.body.addEventListener('keyup', debounce(editable, 1000))

},{"./deps/highlight/highlight.js":2,"./helpers.js":3}],2:[function(require,module,exports){
/*
 * This is a heavily modified version of the jQuery highlight-within-textarea plugin
 *
 * @author  Will Boyd
 * @github  https://github.com/lonekorean/highlight-within-textarea
 */

const ID = 'hwt'

let highlighter

// jQuery like helper function for getting/setting styles and properties of an element
function css (element, styles, styleValues = false) {
  if (Array.isArray(styles)) {
    const requestedStyles = {}
    styles.forEach((style) => {
      if (styleValues) {
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

// simple helper that creates an element and adds classes
function createElementWithClasses (type, classes) {
  const element = document.createElement(type)
  classes.forEach((klass) => element.classList.add(klass))
  return element
}

const HighlightWithinTextarea = function (el, config) {
  this.init(el, config)
}

HighlightWithinTextarea.prototype = {
  init: function (el, config) {
    this.el = el
    this.class = config.className
    this.misspeltWords = config.highlight
    this.generate()
  },

  // generate the required wrapping divs and containers
  generate: function () {
    console.log('generating')
    // Get styles from textarea being spell checked
    const textareaStyles = window.getComputedStyle(this.el)
    const highlightProps = css(textareaStyles, [
      'font-size',
      'font-family',
      'font-weight',
      'line-height',
      'letter-spacing',
      'border',
      'padding-top',
      'padding-right',
      'padding-bottom',
      'padding-left'
    ], true)

    const containerProps = css(textareaStyles,
      ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'], true)

    // used to restore cursor position/selected text inside textarea
    const selections = {
      start: this.el.selectionStart,
      end: this.el.selectionEnd
    }

    this.container = createElementWithClasses('div', [`${ID}-container`])
    this.container = css(this.container, containerProps)

    this.el.classList.add(`${ID}-input`, `${ID}-content`)
    this.el.addEventListener('input', this.highlightText.bind(this))
    this.el.addEventListener('scroll', this.handleScroll.bind(this))

    this.highlights = createElementWithClasses('div', [`${ID}-highlights`, `${ID}-content`])
    this.highlights = css(this.highlights, highlightProps)

    this.backdrop = createElementWithClasses('div', [`${ID}-backdrop`])
    this.backdrop.style['background-colour'] = textareaStyles.getPropertyValue('background-color')
    this.backdrop.append(this.highlights)

    this.el.parentNode.insertBefore(this.container, this.el)
    this.container.appendChild(this.el)
    this.el.parentNode.insertBefore(this.backdrop, this.el)

    this.el.focus()
    this.el.setSelectionRange(selections.start, selections.end)

    this.padHighlights()
    // call main method to highlight existing input
    this.highlightText(this.misspeltWords)
  },

  // expects an array of words and gets the range of each misspelt word inside the input
  // by updating the index as we search we make sure to only search the remainder of the string
  // this means words mispelled twice in the same sentence will still have the correct range
  highlightText: function () {
    console.log('highlight text')
    let input = this.el.value
    let index = 0

    this.misspeltWords.forEach((word) => {
      index = input.indexOf(word, index)
      if (index !== -1) {
        const markup = `<mark class=${this.class}>${word}</mark>`
        const start = index
        const end = index + word.length
        input = input.slice(0, start) + markup + input.slice(end)
        index += markup.length
      } else {
        console.warn(`Warning! Could not find index of ${word}! in string remainder`)
      }
    })

    this.highlights.innerHTML = input
  },

  handleScroll: function () {
    console.log('handle scroll')
    const scrollTop = this.el.scrollTop
    if (scrollTop) {
      this.backdrop.scrollTop = scrollTop
    } else {
      console.warn('MultDict: scrollTop method unavailable.')
    }
  },

  // take padding and border pixels from textarea and add them to padding of highlights div
  padHighlights: function () {
    const paddingAndBorder = css(this.el, [
      'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'
    ])

    const padding = {
      'padding-top': 0,
      'padding-right': 0,
      'padding-bottom': 0,
      'padding-left': 0
    }

    Object.entries(paddingAndBorder).forEach(([key, value]) => {
      if (key.includes('top')) padding['padding-top'] += parseInt(value, 10)
      if (key.includes('right')) padding['padding-right'] += parseInt(value, 10)
      if (key.includes('bottom')) padding['padding-bottom'] += parseInt(value, 10)
      if (key.includes('left')) padding['padding-left'] += parseInt(value, 10)
    })

    Object.keys(padding).forEach((key) => { padding[key] += 'px' })

    this.highlights = css(this.highlights, padding)
  },

  destroy: function () {
    console.log('destroying')
    const parent = this.el.parentNode

    if (parent !== document.body) {
      parent.parentNode.insertBefore(this.el, parent)
      parent.parentNode.removeChild(parent)
    }

    this.backdrop.remove()
    this.el.classList.remove(`${ID}-content`, `${ID}-input`)
    this.el.removeEventListener('input', this.highlightText.bind(this))
    this.el.removeEventListener('scroll', this.handleScroll.bind(this))
  }
}

// generate backdrop div that inherits/copies all properties from textarea being spellchecked
// move textarea node into highlight container, keeping focus, cursor position, and selected text
// add text from textarea to innerHTML of div, wrapping all misspelt words in <mark> tags
// event listener should copy any text entered into the textarea into the div

function highlight (node, options) {
  if (highlighter) {
    // TODO: see if this can be optimised by avoding the destroy each time?
    // highlighter.highlightText(options.highlight)
    highlighter.destroy()
  }
  highlighter = new HighlightWithinTextarea(node, options)
}

module.exports = { highlight }

},{}],3:[function(require,module,exports){
// custom promisifed async forEach function taken from p-iteration
async function forEach (array, callback, thisArg) {
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

// read a text file, the firefox extension way
function readFile (path) {
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

// check spelling of content and return misspelt words and suggestions
function checkSpelling (spell, content) {
  const spelling = {
    cleanedContent: [],
    misspeltWords: [],
    suggestions: {}
  }

  // split string by spaces and strip out punctuation that does not form part of the word itself
  // then remove any email strings, numbers, or text that is less than 2 characters in length
  spelling.cleanedContent = content.split(/(?:\s)/)
    .reduce((acc, string) => acc.concat([string.replace(/(\B\W|\W\B)/gm, '')]), [])
    .reduce((acc, string) => {
      return string.length > 1 && isNaN(string) && !string.includes('@')
        ? acc.concat([string])
        : acc
    }, [])

  for (const word of spelling.cleanedContent) {
    if (!spell.correct(word)) {
      spelling.suggestions[word] = spell.suggest(word)
      spelling.misspeltWords.push(word)
    }
  }

  console.log('cleaned content', spelling.cleanedContent)
  console.log('misspelt words', spelling.misspeltWords)
  console.log('suggestions', spelling.suggestions)

  return spelling
}

// sexy es6 debounce with spread operator
function debounce (callback, wait) {
  let timeout
  return (...args) => {
    const context = this
    clearTimeout(timeout)
    timeout = setTimeout(() => callback.apply(context, args), wait)
  }
}

// get text from a given node
function getText (node) {
  if (node.nodeName === 'INPUT' || node.nodeName === 'TEXTAREA') {
    return node.value
  } else {
    return node.innerText
  }
}

// get local dictionary files according to supported languages
async function loadDictionariesAndPrefs (languages) {
  const dicts = []
  let prefs = []
  return forEach(languages, async (lang) => {
    prefs.push(lang)
    const dic = await readFile(browser.runtime.getURL(`./dictionaries/${lang}.dic`))
    const aff = await readFile(browser.runtime.getURL(`./dictionaries/${lang}.aff`))
    if (!dic.error && !aff.error) {
      dicts.push({ languageCode: lang, dic: dic, aff: aff })
    } else {
      // prevent race condition when reading files changes the preferred language order
      prefs = prefs.filter((value) => value !== lang)
    }
  }).then(function () {
    return { dicts, prefs }
  }).catch(function (err) {
    console.log(err)
  })
}

module.exports = {
  checkSpelling,
  debounce,
  getText,
  loadDictionariesAndPrefs
}

},{}]},{},[1]);
