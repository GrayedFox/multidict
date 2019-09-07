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
