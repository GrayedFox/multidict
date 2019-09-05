(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const messageHandler = browser.runtime.connect({ name: 'spell-checker' })
const editableFields = ['TEXTAREA']
const { debounce, getText } = require('./helpers.js')
const { highlight } = require('./deps/highlight/highlight-within-textarea.js')

let node

// catches editable fields being clicked on or edited
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
  console.log('Got message from background...')
  console.log(message)
  if (message.spelling) {
    highlight(node, {
      highlight: message.spelling.misspeltWords,
      className: 'red'
    })

    // node.parentNode.append(result.$container)
    // node.parentNode.appendChild(result.$container)
  }
})

messageHandler.onDisconnect.addListener((p) => {
  if (p.error) {
    console.log(`Disconnected due to an error: ${p.error.message}`)
  }
})

// BUG: click event listener sends single line of text instead of content of entire editable field
// TODO: tie click event to showing suggested words instead of spell checking
// document.body.addEventListener('click', debounce(word, 200))
document.body.addEventListener('keyup', debounce(editable, 1200))

// injects a keyup listener for spell checking words, which then highlights misspelt words

},{"./deps/highlight/highlight-within-textarea.js":2,"./helpers.js":3}],2:[function(require,module,exports){
const ID = 'hwt'

let highlighter

// jQuery like helper function for getting/setting styles and properties of element
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
    this.generate()
  },

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

    console.log(highlightProps)

    const containerProps = css(textareaStyles,
      ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'], true)

    const selections = this.getPositions()

    this.container = createElementWithClasses('div', [`${ID}-container`])
    this.container = css(this.container, containerProps)

    this.el.classList.add(`${ID}-input`, `${ID}-content`)
    this.el.addEventListener('input', this.handleInput.bind(this))
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

    // this.fixFirefox()

    // trigger input event to highlight any existing input
    // this.handleInput()
  },

  getPositions: function () {
    console.log('get textarea positions')
    const el = this.el
    return {
      start: el.selectionStart,
      end: el.selectionEnd,
      cursor: el.selectionStart === el.selectionEnd
        ? el.selectionStart / el.value.length
        : undefined
    }
  },

  handleInput: function () {
    console.log('handle input')
    const input = this.el.value
    const ranges = this.getRanges(input, this.highlight)
    const unstaggeredRanges = this.removeStaggeredRanges(ranges)
    const boundaries = this.getBoundaries(unstaggeredRanges)
    this.renderMarks(boundaries)
  },

  getStringRanges: function (input, str) {
    const ranges = []
    const inputLower = input.toLowerCase()
    const strLower = str.toLowerCase()
    let index = 0
    while (index = inputLower.indexOf(strLower, index), index !== -1) {
      ranges.push([index, index + strLower.length])
      index += strLower.length
    }
    return ranges
  },

  renderMarks: function (boundaries) {
    console.log('render marks')
    let input = this.el.value

    boundaries.forEach(function (boundary, index) {
      let markup
      if (boundary.type === 'start') {
        markup = '{{hwt-mark-start|' + index + '}}'
      } else {
        markup = '{{hwt-mark-stop}}'
      }
      input = input.slice(0, boundary.index) + markup + input.slice(boundary.index)
    })

    // this keeps scrolling aligned when input ends with a newline
    // input = input.replace(/\n(\{\{hwt-mark-stop\}\})?$/, '\n\n$1')

    // encode HTML entities
    input = input.replace(/</g, '&lt;').replace(/>/g, '&gt;')

    // replace start tokens with opening <mark> tags with class name
    input = input.replace(/\{\{hwt-mark-start\|(\d+)\}\}/g, function (match, submatch) {
      const className = boundaries[+submatch].className
      if (className) {
        return '<mark class="' + className + '">'
      } else {
        return '<mark>'
      }
    })

    // replace stop tokens with closing </mark> tags
    input = input.replace(/\{\{hwt-mark-stop\}\}/g, '</mark>')
    this.highlights.innerHTML = input
  },

  handleScroll: function () {
    console.log('handle scroll')
    const scrollTop = this.el.scrollTop()
    this.backdrop.scrollTop(scrollTop)
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
    this.el.removeEventListener('input', this.handleInput.bind(this))
    this.el.removeEventListener('scroll', this.handleScroll.bind(this))
  }
}

// add custom class names from options
function getCustomRanges (input, custom) {
  const ranges = this.getRanges(input, custom.highlight)
  if (custom.className) {
    ranges.forEach(function (range) {
      // persist class name as a property of the array
      if (range.className) {
        range.className = custom.className + ' ' + range.className
      } else {
        range.className = custom.className
      }
    })
  }
  return ranges
}

// generate backdrop div that inherits/copies all properties from textarea being spellchecked
// move textarea node into highlight container, keeping focus, cursor position, and selected text
// add text from textarea to innerHTML of div, wrapping all misspelt words in <mark> tags
// event listener should copy any text entered into the textarea into the div

function highlight (node, options) {
  if (highlighter) {
    highlighter.destroy()
  }
  highlighter = new HighlightWithinTextarea(node, options)
}

// function handleScroll (node) {
//   const scrollTop = node.scrollTop()
//   backdrop.scrollTop(scrollTop)
// }
//
// function applyHighlights (text) {
//   return text.reduce((acc, word) => {
//     acc += `<mark>${word}</mark>`
//   })
// }
//
// function handleInput (node) {
//   var text = node.value
//   var highlightedText = applyHighlights(text)
//   highlights.html(highlightedText)
// }
//
//   // Firefox doesn't show text that scrolls into the padding of a textarea, so
// rearrange a couple box models to make highlights behave the same way
// fixFirefox: function () {
//   // take padding and border pixels from highlights div
//   const padding = css(this.highlights, [
//     'padding-top', 'padding-right', 'padding-bottom', 'padding-left'
//   ])
//
//   const border = css(this.highlights, [
//     'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'
//   ])
//
//   this.highlights = css(this.highlights, {
//     padding: '0',
//     'border-width': '0'
//   })
//
//   this.backdrop = css(this.backdrop, {
//     // add padding pixels to backdrop div
//     'margin-top': '+=' + padding['padding-top'],
//     'margin-right': '+=' + padding['padding-right'],
//     'margin-bottom': '+=' + padding['padding-bottom'],
//     'margin-left': '+=' + padding['padding-left']
//   })
//   // console.log(css(this.backdrop, ['margin-top']))
//
//   this.backdrop = css(this.backdrop, {
//     // add border pixels to backdrop div
//     'margin-top': '+=' + border['border-top-width'],
//     'margin-right': '+=' + border['border-right-width'],
//     'margin-bottom': '+=' + border['border-bottom-width'],
//     'margin-left': '+=' + border['border-left-width']
//   })
//   // console.log(css(this.backdrop, ['margin-top']))
// },

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

// read a file, the firefox extension way
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

// return misspelt words and suggestions
function checkSpelling (spell, content) {
  const spelling = {
    suggestions: {},
    misspeltWords: []
  }

  // split string by spaces and strip out punctuation that does not form part of the word itself
  // then remove any strings that are numbers or less than 1 char in length
  const cleanedContent = content.split(/(?:\s)/)
    .reduce((acc, string) => acc.concat([string.replace(/(\B\W|\W\B|\s)/gm, '')]), [])
    .reduce((acc, string) => {
      return string.length > 1 && isNaN(string) && !string.includes('@')
        ? acc.concat([string])
        : acc
    }, [])

  console.log(cleanedContent)

  for (const string of cleanedContent) {
    if (!spell.correct(string)) {
      spelling.suggestions[string] = spell.suggest(string)
      spelling.misspeltWords.push(string)
    }
  }

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
      // prevent race condition when reading files changing the preferred language order
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
