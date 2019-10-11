/*
 * This file began as a heavily modified version of the jQuery highlight-within-textarea plugin and
 * then slowly evolved into the main page script that does all the client side heavy lifting for
 * MultiDict.
 *
 * Given how much of the file is still quite clearly and recognizably the work of someone else I
 * thought it was only fair (not to mention the legal obligation!) to leave this notice here, so,
 * thank you Mr. Boyd.
 *
 * @author  Will Boyd and Che Fisher
 * @github  https://github.com/lonekorean/highlight-within-textarea
 */

const { getCurrentWord, isWholeWord } = require('../../helpers.js')
const { Word } = require('../../classes.js')

const ID = 'multidict'

let highlighter, boundClick, boundInput, boundKeyup, boundScroll, boundSelect

// make target mark element blink N times over M milliseconds by removing/adding class
function _blinkMark (mark, times, milliseconds) {
  const tempInterval = setInterval(() => {
    const classList = mark.classList
    classList.contains(('red')) ? classList.remove('red') : classList.add('red')
  }, Math.round(milliseconds / times))

  setTimeout(() => {
    clearInterval(tempInterval)
    mark.classList.add('red')
  }, milliseconds)
}

// jQuery like helper function for getting/setting property values or computed styles of an element
// pass an object as 2nd param to set styles, or an array as 2nd param to get them
// 3rd param dictates whether to get computed styles or not (defaults to false)
function _css (element, styles, computedStyles = false) {
  if (Array.isArray(styles)) {
    const requestedStyles = {}
    styles.forEach((style) => {
      if (computedStyles) {
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

// helper function that creates an element and adds classes
function _createElementWithClasses (type, classes) {
  const element = document.createElement(type)
  classes.forEach((klass) => element.classList.add(klass))
  return element
}

// helper function that adds pixels to an existing pixel property
function _addPixels (property, value) {
  return `${Number.parseInt(property) + value}px`
}

// helper function that gets the position of the required mark to show word suggestions
function _getMatchingMarkIndex (content, word) {
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
      console.warn('MultiDict: get matching mark could not find matching word inside content!')
      break
    }
  }
  return markIndex
}

// sets the mark that we will use for showing suggestions
function _setTargetMark (word, index) {
  console.log('setting target mark')
  highlighter.mark = [...highlighter.highlights.children].reduce((acc, child) => {
    return child.textContent === word ? acc.concat([child]) : acc
  }, [])[index]
}

// replace a word by using its boundaries to insert a new word in its place
function _replaceInText (text, word, replacement) {
  console.log('replace in text')
  return `${text.slice(0, word.start)}${replacement}${text.slice(word.end)}`
}

const HighlightWithinTextarea = function (el, config) {
  this.init(el, config)
}

HighlightWithinTextarea.prototype = {
  init: function (el, config) {
    this.el = el
    this.class = config.className
    this.misspeltWords = config.misspeltWords
    this.suggestions = config.suggestions
    this.showingSuggestions = false
    this.acceptedWord = undefined
    this.mark = undefined
    this.suggestionIndex = 0
    this.radius = 0
    this.theta = 0
    this.generate()
  },

  // generate the required wrapping divs and containers
  generate: function () {
    console.log('generating')
    // Get styles from textarea being spell checked
    const textareaStyles = window.getComputedStyle(this.el)
    const size = _css(this.el, ['width', 'height'])
    const highlightsProps = _css(textareaStyles, [
      'font-size', 'font-family', 'font-weight', 'line-height', 'letter-spacing', 'text-align',
      'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
      'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
      'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'padding-top', 'padding-right', 'padding-bottom', 'padding-left'
    ], true)

    // used to restore cursor position/selected text inside textarea
    const selections = {
      start: this.el.selectionStart,
      end: this.el.selectionEnd
    }

    boundClick = this.handleClick.bind(this)
    boundInput = this.handleInput.bind(this)
    boundKeyup = this.handleKeyup.bind(this)
    boundScroll = this.handleScroll.bind(this)
    boundSelect = this.handleSelect.bind(this)

    this.el.addEventListener('click', boundClick)
    this.el.addEventListener('input', boundInput)
    this.el.addEventListener('keyup', boundKeyup)
    this.el.addEventListener('scroll', boundScroll)
    this.el.addEventListener('select', boundSelect)

    this.container = _createElementWithClasses('div', [`${ID}-container`])
    this.backdrop = _createElementWithClasses('div', [`${ID}-backdrop`])
    this.highlights = _createElementWithClasses('div', [`${ID}-highlights`, `${ID}-content`])

    this.highlights = _css(this.highlights, highlightsProps)
    this.backdrop.style['background-colour'] = textareaStyles.getPropertyValue('background-color')

    this.el.classList.add(`${ID}-input`, `${ID}-content`)
    // restore original height and width of textarea (FF kept shrinking it)
    this.el.style.height = size.height
    this.el.style.width = size.width

    this.backdrop.append(this.highlights)
    this.el.parentNode.insertBefore(this.container, this.el)
    this.container.appendChild(this.el)
    this.el.parentNode.insertBefore(this.backdrop, this.el)

    this.el.focus()
    this.el.setSelectionRange(selections.start, selections.end)

    this.handleSelect()
    this.handleInput()

    this.el.setAttribute('data-multidict-generated', true)
  },

  // we don't just show suggestions - we generate the required divs at runtime as soon if the user
  // has pressed alt+shift+up/down, and destroy the divs on the next keyup event that does not have
  // alt+shift pressed
  showSuggestions: function (words) {
    console.log('show suggestions')
    const textareaStyles = window.getComputedStyle(this.el)
    const suggestionsProps = _css(textareaStyles, [
      'font-size', 'font-family', 'font-weight', 'letter-spacing', 'color'
    ], true)

    const height = _addPixels(suggestionsProps['font-size'], 10)

    this.suggestionsWrapper = _createElementWithClasses('div', [`${ID}-suggestions-wrapper`])
    this.suggestionsContainer = _createElementWithClasses('div', [`${ID}-suggestions-container`])
    this.suggestionsContainer.style.height = height

    this.suggestionsFrame = _createElementWithClasses('div', [`${ID}-suggestions-frame`])
    this.suggestionsFrame = _css(this.suggestionsFrame, suggestionsProps)
    this.suggestionsFrame.style.height = suggestionsProps['font-size']
    this.suggestionsFrame.style['line-height'] = suggestionsProps['font-size']

    this.suggestionsWrapper.append(this.suggestionsContainer)
    this.suggestionsContainer.append(this.suggestionsFrame)

    this.el.style.filter = 'blur(2px)'
    this.mark.style.visibility = 'hidden'
    this.mark.prepend(this.suggestionsWrapper)

    const heightOffset = this.suggestionsContainer.offsetHeight
    // limit carousel suggestions to top 4 (can make configurable later)
    words = words.slice(0, 4)

    this.theta = 360 / words.length
    this.radius = Math.round((heightOffset / 2) / Math.tan(Math.PI / words.length))
    this.radius = Math.sign(this.radius) < 1 ? 0 : this.radius

    for (let i = 0; i < words.length; i++) {
      const angle = this.theta * i
      const suggestion = _createElementWithClasses('div', [`${ID}-suggestion`])
      suggestion.innerText = words[i]
      suggestion.style.transform = `rotateX(${angle}deg) translateZ(${this.radius}px)`
      this.suggestionsFrame.append(suggestion)
    }

    this.showingSuggestions = true
  },

  hideSuggestions: function () {
    console.log('hide suggestions')
    this.suggestionsWrapper.remove()
    this.acceptedWord = null
    this.el.style.filter = null
    this.suggestionIndex = 0
    this.showingSuggestions = false
  },

  handleClick: function () {
    console.log('handle click')
    this.handleSelect()
  },

  // wraps misspelt word inside the highlights div in <mark> tags, add word suggestions
  // by updating the search index as we go we make sure to only search the remainder of the string
  // this means words mispelled twice in the same sentence will be wrapped properly
  handleInput: function () {
    console.log('handle input')

    let input = this.el.value
    let index = 0

    this.misspeltWords.forEach((word) => {
      index = input.indexOf(word, index)
      // since deleting or selecting text doesn't trigger a spell check it's possible that we won't
      // find a misspelt word in the remaining text, which is fine
      if (index !== -1 && isWholeWord(word, input, index)) {
        const markup = `<mark class="${this.class}">${word}</mark>`
        const start = index
        const end = index + word.length
        input = input.slice(0, start) + markup + input.slice(end)
        index += markup.length
      }
    })

    // this keeps the highlights aligned if input textarea/div ends with a new line
    input = input.replace(/\n?$/, '\n\n$1')

    // TODO: this may fail the Firefox audit when publishing, may need to use DOM manipulation
    this.highlights.innerHTML = input
  },

  handleKeyup: function (e) {
    console.log('handle keyup')
    const directions = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' }
    const direction = directions[e.keyCode]
    const selections = {
      start: this.el.selectionStart,
      end: this.el.selectionEnd
    }

    if (this.showingSuggestions && !(e.shiftKey && e.altKey)) {
      if (this.acceptedWord) {
        const newText = _replaceInText(this.el.value, this.editableWord, this.acceptedWord)
        this.el.value = newText
        this.el.setSelectionRange(selections.start, selections.end)
        this.handleInput()
      }
      this.hideSuggestions()
    }

    this.handleSelect()

    const currentWord = new Word(...this.el.getAttribute('data-multidict-selected-word').split(','))
    const currentWordSuggestions = this.suggestions[currentWord.text]

    if (e.shiftKey && e.altKey && direction) {
      if (direction === 'up' || direction === 'down') {
        if (!this.showingSuggestions && currentWordSuggestions) {
          _setTargetMark(currentWord.text, _getMatchingMarkIndex(this.el.value, currentWord))
          this.showSuggestions(currentWordSuggestions.suggestedWords)
          this.editableWord = currentWord
        }

        if (!currentWordSuggestions && this.misspeltWords.includes(currentWord.text)) {
          _setTargetMark(currentWord.text, _getMatchingMarkIndex(this.el.value, currentWord))
          _blinkMark(this.mark, 4, 600)
        }

        if (this.showingSuggestions) {
          e.preventDefault()
          this.handleRotate(direction)
        }
      } else {
        if (this.showingSuggestions) {
          this.acceptedWord = undefined
          this.mark.style.visibility = null
          this.hideSuggestions()
        }
      }
    }
  },

  handleRotate: function (direction) {
    console.log('handle rotate')
    direction === 'up' ? this.suggestionIndex-- : this.suggestionIndex++

    const angle = this.theta * this.suggestionIndex * -1
    const cellCount = this.suggestionsFrame.children.length
    let current = Math.abs(this.suggestionIndex % cellCount)

    if (this.suggestionIndex < 0 && current !== 0) {
      current = cellCount - current
    }

    this.acceptedWord = this.suggestions[this.editableWord.text].suggestedWords[current]
    console.log(this.acceptedWord)

    for (let i = 0; i < cellCount; i++) {
      const next = current + 1 === cellCount ? 0 : current + 1
      const suggestionDiv = this.suggestionsFrame.children[i]
      let opacity = null
      switch (i) {
        case current:
          opacity = 1
          break
        case next:
          opacity = cellCount > 2 ? 0.3 : 0
          break
        default:
          opacity = 0.3
      }

      suggestionDiv.style.opacity = opacity
    }

    this.suggestionsFrame.style.transform = `translateZ(${-this.radius}px) rotateX(${angle}deg)`
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

  handleSelect: function () {
    console.log('handle select')
    const word = getCurrentWord(this.el)
    this.el.setAttribute('data-multidict-selected-word', [...word])
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
    this.el.removeEventListener('input', boundInput)
    this.el.removeEventListener('click', boundClick)
    this.el.removeEventListener('keyup', boundKeyup)
    this.el.removeEventListener('scroll', boundScroll)
    this.el.removeEventListener('select', boundSelect)
  }
}

// generate highlights div that inherits/copies all properties from textarea being spellchecked
// move textarea node into highlight container, keeping focus, cursor position, and selected text
// add text from textarea to innerHTML of div, wrapping all misspelt words in <mark> tags
// all handles showing word suggestions to users
function highlight (node, options) {
  if (highlighter) {
    highlighter.destroy()
  }
  highlighter = new HighlightWithinTextarea(node, options)
}

module.exports = { highlight }
