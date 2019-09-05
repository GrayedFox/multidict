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
    console.log(selections)

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

    // this.fixFirefox()

    // trigger input event to highlight any existing input
    // this.handleInput()
  },

  getPositions: function () {
    console.log('get textarea positions')
    const el = this.el
    return {
      startPosition: el.selectionStart,
      endPosition: el.selectionEnd,
      cursorPosition: el.selectionStart === el.selectionEnd
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
