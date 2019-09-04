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
    const result = highlight(node, {
      highlight: message.spelling.misspeltWords,
      className: 'red'
    })
    console.log('result', result)

    node.remove()
    document.body.appendChild(result.$container)
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
/*
 * highlight-within-textarea
 *
 * @author  Will Boyd
 * @github  https://github.com/lonekorean/highlight-within-textarea
 */

const ID = 'hwt'

let plugin

const HighlightWithinTextarea = function ($el, config) {
  this.init($el, config)
}

HighlightWithinTextarea.prototype = {
  init: function ($el, config) {
    this.$el = $el

    if (this.getType(config) === 'custom') {
      this.highlight = config
      this.generate()
    } else {
      console.error('valid config object not provided')
    }
  },

  // returns identifier strings that aren't necessarily "real" JavaScript types
  getType: function (instance) {
    const type = typeof instance
    if (!instance) {
      return 'falsy'
    } else if (Array.isArray(instance)) {
      if (instance.length === 2 && typeof instance[0] === 'number' && typeof instance[1] === 'number') {
        return 'range'
      } else {
        return 'array'
      }
    } else if (type === 'object') {
      if (instance instanceof RegExp) {
        return 'regexp'
      } else if (instance.hasOwnProperty('highlight')) {
        return 'custom'
      }
    } else if (type === 'function' || type === 'string') {
      return type
    }

    return 'other'
  },

  generate: function () {
    console.log('generating')
    this.$el.classList.add(`${ID}-input`, `${ID}-content`)
    this.$el.addEventListener('input', this.handleInput.bind(this))
    this.$el.addEventListener('scroll', this.handleScroll.bind(this))
    // .on('input.' + ID, this.handleInput.bind(this))
    // .on('scroll.' + ID, this.handleScroll.bind(this))

    function createElWithClass (type, klass) {
      const el = document.createElement(type)
      el.classList.add(klass)
      return el
    }

    this.$highlights = createElWithClass('div', `${ID}-highlights`)
    this.$highlights.classList.add(`${ID}-content`)

    this.$backdrop = createElWithClass('div', `${ID}-backdrop`)
    this.$backdrop.append(this.$highlights)

    this.$container = createElWithClass('div', `${ID}-container`)
    this.$container.appendChild(this.$el)
    this.$container.append(this.$backdrop, this.$el)

    // this.fixFirefox()

    // plugin function checks this for success
    // this.isGenerated = true

    // trigger input event to highlight any existing input
    this.handleInput()
  },

  // Firefox doesn't show text that scrolls into the padding of a textarea, so
  // rearrange a couple box models to make highlights behave the same way
  // fixFirefox: function () {
  //   // take padding and border pixels from highlights div
  //   const padding = this.$highlights.css([
  //     'padding-top', 'padding-right', 'padding-bottom', 'padding-left'
  //   ])
  //
  //   const border = this.$highlights.css([
  //     'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'
  //   ])
  //   this.$highlights.css({
  //     padding: '0',
  //     'border-width': '0'
  //   })
  //
  //   this.$backdrop
  //     // jquery setting css with object notation
  //     .css({
  //       // give padding pixels to backdrop div
  //       'margin-top': '+=' + padding['padding-top'],
  //       'margin-right': '+=' + padding['padding-right'],
  //       'margin-bottom': '+=' + padding['padding-bottom'],
  //       'margin-left': '+=' + padding['padding-left']
  //     })
  //     .css({
  //       // give border pixels to backdrop div
  //       'margin-top': '+=' + border['border-top-width'],
  //       'margin-right': '+=' + border['border-right-width'],
  //       'margin-bottom': '+=' + border['border-bottom-width'],
  //       'margin-left': '+=' + border['border-left-width']
  //     })
  // },

  handleInput: function () {
    console.log('handle input')
    const input = this.$el.value
    const ranges = this.getRanges(input, this.highlight)
    const unstaggeredRanges = this.removeStaggeredRanges(ranges)
    const boundaries = this.getBoundaries(unstaggeredRanges)
    this.renderMarks(boundaries)
  },

  getRanges: function (input, highlight) {
    const type = this.getType(highlight)
    switch (type) {
      case 'array':
        return this.getArrayRanges(input, highlight)
      case 'function':
        return this.getFunctionRanges(input, highlight)
      case 'regexp':
        return this.getRegExpRanges(input, highlight)
      case 'string':
        return this.getStringRanges(input, highlight)
      case 'range':
        return this.getRangeRanges(input, highlight)
      case 'custom':
        return this.getCustomRanges(input, highlight)
      default:
        if (!highlight) {
          // do nothing for falsy values
          return []
        } else {
          console.error('unrecognized highlight type')
        }
    }
  },

  getArrayRanges: function (input, arr) {
    const ranges = arr.map(this.getRanges.bind(this, input))
    return Array.prototype.concat.apply([], ranges)
  },

  getFunctionRanges: function (input, func) {
    return this.getRanges(input, func(input))
  },

  getRegExpRanges: function (input, regex) {
    const ranges = []
    let match
    while (match = regex.exec(input), match !== null) {
      ranges.push([match.index, match.index + match[0].length])
      if (!regex.global) {
        // non-global regexes do not increase lastIndex, causing an infinite loop,
        // but we can just break manually after the first match
        break
      }
    }
    return ranges
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

  getRangeRanges: function (input, range) {
    return [range]
  },

  getCustomRanges: function (input, custom) {
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
  },

  // prevent staggered overlaps (clean nesting is fine)
  removeStaggeredRanges: function (ranges) {
    const unstaggeredRanges = []
    ranges.forEach(function (range) {
      const isStaggered = unstaggeredRanges.some(function (unstaggeredRange) {
        const isStartInside = range[0] > unstaggeredRange[0] && range[0] < unstaggeredRange[1]
        const isStopInside = range[1] > unstaggeredRange[0] && range[1] < unstaggeredRange[1]
        return isStartInside !== isStopInside // xor
      })
      if (!isStaggered) {
        unstaggeredRanges.push(range)
      }
    })
    return unstaggeredRanges
  },

  getBoundaries: function (ranges) {
    const boundaries = []
    ranges.forEach(function (range) {
      boundaries.push({
        type: 'start',
        index: range[0],
        className: range.className
      })
      boundaries.push({
        type: 'stop',
        index: range[1]
      })
    })

    this.sortBoundaries(boundaries)
    return boundaries
  },

  sortBoundaries: function (boundaries) {
    // backwards sort (since marks are inserted right to left)
    boundaries.sort(function (a, b) {
      if (a.index !== b.index) {
        return b.index - a.index
      } else if (a.type === 'stop' && b.type === 'start') {
        return 1
      } else if (a.type === 'start' && b.type === 'stop') {
        return -1
      } else {
        return 0
      }
    })
  },

  // wrap all
  renderMarks: function (boundaries) {
    console.log('render marks')
    let input = this.$el.value
    const marks = []

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
    input = input.replace(/\n(\{\{hwt-mark-stop\}\})?$/, '\n\n$1')

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
    console.log('input', input)

    this.$highlights.innerHTML = input
  },

  handleScroll: function () {
    console.log('handle scroll')
    const scrollTop = this.$el.scrollTop()
    this.$backdrop.scrollTop(scrollTop)
  },

  destroy: function () {
    console.log('destroying')
    this.$backdrop.remove()
    this.$el
      .unwrap()
      .removeClass(ID + '-text ' + ID + '-input')
      .off(ID)
      .removeData(ID)
  }
}

function highlightWithinTextarea (node, options) {
  const $el = node.cloneNode()

  if (typeof options === 'string') {
    if (plugin) {
      switch (options) {
        case 'update':
          plugin.handleInput()
          break
        case 'destroy':
          plugin.destroy()
          break
        default:
          console.error('unrecognized method string')
      }
    } else {
      console.error('plugin must be instantiated first')
    }
  } else {
    if (plugin) {
      plugin.destroy()
    }
    plugin = new HighlightWithinTextarea($el, options)
    return plugin
  }
}

// function handleScroll (node) {
//   const scrollTop = node.scrollTop()
//   $backdrop.scrollTop(scrollTop)
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
//   $highlights.html(highlightedText)
// }

module.exports = {
  highlight: highlightWithinTextarea
}

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
