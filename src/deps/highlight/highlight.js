/*
 * This began as a modified version of the jQuery highlight-within-textarea plugin and then slowly
 * evolved (nearly beyond recognition) into the main page script that does most of the client side
 * heavy lifting for MultiDict.
 *
 * Although it's developed far beyond that original plugin, it still began as a file that was the
 * work of someone else and I thought it was only fair to leave this notice here and offer credit
 * where credit is due, so, thank you Mr. Boyd!
 *
 * @author  Che Fisher and Will Boyd
 * @github  https://github.com/lonekorean/highlight-within-textarea
 */

const {
  blinkMark, createClassyElement, css, getDomainSpecificProps, getMatchingMarkIndex,
  getTextContent, getCurrentWordBounds, getSelectionBounds, isWholeWord, replaceInText
} = require('../../helpers.js')

const { Word, WordCarousel } = require('../../classes.js')

const ID = 'multidict'

let boundClick, boundKeyup, boundScroll, boundSelect

// ToDo: add MutationObserver for updating width and height values used when generating/updating
// textarea

// A Highlighter is a page/tab agnostic collection of HTML elements that work together to highlight
// misspelt words with mark tags by wrapping a given editable node in a special container that
// tracks changes to the editable node
class Highlighter {
  constructor (node, spelling, color) {
    this.node = node
    this.textNode = node
    this.spelling = spelling
    this.color = color
    this.carousel = null // the WordCarousel (if active) showing word suggestions
    this.currentMark = undefined // currently active/selected mark node based on cursor position
    this.currentWord = undefined // currently active/selected Word based on cursor position
    this.container = createClassyElement('div', [`${ID}-container`])
    this.backdrop = createClassyElement('div', [`${ID}-backdrop`])
    this.highlights = createClassyElement('div', [`${ID}-highlights`, `${ID}-content`])

    this._buildHighlighter()
  }

  chooseSuggestion () {
    console.log('choose suggestion')
    const currentWord = this.currentWord
    const currentText = getTextContent(this.node)
    const restoreSelection = this.storeSelection(this.node)
    const misspeltWordIndex = this.getMisspeltWordIndex(currentWord.text, this.currentMarkIndex)

    this.spelling.misspeltWords.remove(misspeltWordIndex)
    this.node.value = replaceInText(currentText, currentWord, this.carousel.acceptedWord)
    restoreSelection(this.node)
  }

  createCarousel (suggestions) {
    console.log('create carousel')
    this.carousel = new WordCarousel(this.node, this.currentMark, suggestions)
  }

  destroy () {
    console.log('destroy highlighter')
    this.node.removeEventListener('click', boundClick)
    this.node.removeEventListener('keyup', boundKeyup)
    this.node.removeEventListener('scroll', boundScroll)
    this.node.removeEventListener('select', boundSelect)

    this.container.parentNode.insertBefore(this.node, this.container)
    this.container.remove()
    this.node.removeAttribute('data-multidict-generated')
    this.node.removeAttribute('data-multidict-selected-word')
    this.node.classList.remove(`${ID}-content`, `${ID}-input`)
  }

  destroyCarousel () {
    console.log('destroy carousel')
    this.carousel.hideSuggestions()
    this.carousel.destroy()
    this.carousel = null
  }

  handleCarousel (e, direction) {
    console.log('handle carousel')
    const currentWord = this.currentWord
    const currentWordSuggestions = this.spelling.suggestions[currentWord.text]
    const misspeltWord = this.spelling.misspeltWords[this.currentMarkIndex]

    // if we are showing the carousel but shift and alt are no longer both pressed, destroy it
    // and replace the word with the carousel accepted word (if there is one)
    if (this.carousel && !(e.shiftKey && e.altKey)) {
      if (this.carousel.acceptedWord) {
        this.chooseSuggestion()
      }
      this.destroyCarousel()
      this.highlightMistakes()
    }

    if (e.shiftKey && e.altKey && direction) {
      if (direction === 'up' || direction === 'down') {
        // if no carousel present, create one and show suggestions
        if (!this.carousel && currentWordSuggestions) {
          this.createCarousel(currentWordSuggestions.suggestedWords)
          this.carousel.showSuggestions()
        }
        // if we have no suggestions but the current word is misspelled, blink current mark
        if (!currentWordSuggestions && misspeltWord && this.currentMark) {
          blinkMark(this.currentMark, this.color, 4, 600)
        }
        // rotate the carousel up or down
        if (this.carousel) {
          this.carousel.rotateCarousel(direction)
        }
      } else {
        // if direction is left or right, unset the accepted word and destroy the carousel
        // this allows user to navigate away from carousel without choosing a suggestion
        if (this.carousel && this.carousel.showingSuggestions) {
          this.carousel.acceptedWord = undefined
          this.destroyCarousel()
        }
      }
    }
  }

  handleClick () {
    console.log('handle click')
    this.handleSelect()
  }

  handleKeyup (e) {
    console.log('handle keyup')
    const directions = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' }
    const direction = directions[e.keyCode]

    // only highlight mistakes and update selection if carousel not present/showing suggestions
    if (!this.carousel || (this.carousel && !this.carousel.showingSuggestions)) {
      this.highlightMistakes()
      this.handleSelect()
    }

    // only handle carousel if user has depressed an arrow while holding shift+alt
    // or if they have released the alt or shift keys
    if ((direction && e.shiftKey && e.altKey) || e.keyCode === 16 || e.keyCode === 18) {
      this.handleCarousel(e, direction)
    }
  }

  handleScroll () {
    console.log('handle scroll')
    if (this.node.scrollTop) {
      this.backdrop.scrollTop = this.node.scrollTop
    } else {
      console.warn('MultDict: scrollTop method unavailable...')
    }
  }

  handleSelect () {
    console.log('handle select')
    this.currentWord = new Word(...getCurrentWordBounds(this.node))
    this.currentMarkIndex = getMatchingMarkIndex(getTextContent(this.node), this.currentWord)
    this.setCurrentMark(this.currentWord.text, this.currentMarkIndex)
    this.node.setAttribute('data-multidict-selected-word', [...this.currentWord])
  }

  highlightMistakes () {
    console.log('highlight mistakes')
    let input = getTextContent(this.node)
    let index = 0

    for (const word of this.spelling.misspeltWords) {
      // don't update the search index if word isn't found inside of text remainder
      if (input.indexOf(word.text, index) === -1) {
        continue
      }
      index = input.indexOf(word.text, index)
      if (isWholeWord(word.text, input, index)) {
        const markup = `<mark class="${this.color}">${word.text}</mark>`
        const start = index
        const end = index + word.length
        input = input.slice(0, start) + markup + input.slice(end)
        index += markup.length
      }
    }

    // this keeps the highlights aligned if input textarea/div ends with a new line
    input = input.replace(/\n$/, '\n\n')

    // TODO: this may fail the Firefox audit when publishing, may need to use DOM manipulation
    this.highlights.innerHTML = input
  }

  // gets the index of the misspelt word used to generate the WordCarousel
  // if the misspelt word occurs more than once the reduced array will contain multiple entries
  // requiring the position of the misspelt word dupe (duplicateWordIndex) to be known before hand
  getMisspeltWordIndex (misspeltWord, duplicateWordIndex = 0) {
    return this.spelling.misspeltWords.reduce((acc, word, misspeltWordIndex) => {
      return word.text === misspeltWord ? acc.concat([misspeltWordIndex]) : acc
    }, [])[duplicateWordIndex]
  }

  // sets the mark that we will use for showing suggestions based on a known, specific index
  setCurrentMark (word, index) {
    this.currentMark = [...this.highlights.children].reduce((acc, child) => {
      return child.textContent === word ? acc.concat([child]) : acc
    }, [])[index]
  }

  // set/update the spelling of the current instance and highlight mistakes again
  setSpelling (spelling) {
    console.log('set spelling')
    this.spelling = spelling
    this.highlightMistakes()
  }

  // used to restore a previous selection/cursor position after moving things around in the DOM
  storeSelection (currentNode) {
    const selection = window.getSelection()
    const selectionBounds = getSelectionBounds(currentNode)
    const selectionRange = selection.getRangeAt(0) || null
    const storedRange = {}

    if (selectionRange) {
      storedRange.startContainer = selectionRange.startContainer
      storedRange.startOffset = selectionRange.startOffset
      storedRange.endContainer = selectionRange.endContainer
      storedRange.endOffset = selectionRange.endOffset
      storedRange.parentNode = selectionRange.startContainer.parentNode
    }

    return function (node) {
      node.focus()
      if (node.setSelectionRange) {
        node.setSelectionRange(selectionBounds.start, selectionBounds.end)
      } else {
        if (!storedRange.startContainer.isConnected) {
          storedRange.startContainer = storedRange.parentNode.childNodes[0]
          storedRange.endContainer = storedRange.parentNode.childNodes[0]
        }
        window.getSelection().setBaseAndExtent(
          storedRange.startContainer, storedRange.startOffset,
          storedRange.endContainer, storedRange.endOffset
        )
      }
    }
  }

  // build the Highlighter html elements, position them, and then insert them into the DOM
  // should only be called once during class instantiation
  _buildHighlighter () {
    // Highlighter is built based on styles from textarea being spell checked
    // unforunately a one size fits all approach simply doesn't work (rich text editors i.e. gmail)
    // so some conditional logic is needed to set the correct node/styles

    const restoreSelection = this.storeSelection(this.node)
    const textareaStyles = window.getComputedStyle(this.node)
    const backdropProps = css(textareaStyles, ['background-color'])
    const highlightsProps = css(textareaStyles, [
      'font-size', 'font-family', 'font-weight', 'line-height', 'letter-spacing', 'text-align',
      'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
      'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
      'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'padding-top', 'padding-right', 'padding-bottom', 'padding-left'
    ])

    let containerProps = css(textareaStyles, ['display', 'position'])
    containerProps = getDomainSpecificProps(window.location.hostname, containerProps, this.node)

    boundClick = this.handleClick.bind(this)
    boundKeyup = this.handleKeyup.bind(this)
    boundScroll = this.handleScroll.bind(this)
    boundSelect = this.handleSelect.bind(this)

    this.node.addEventListener('click', boundClick)
    this.node.addEventListener('keyup', boundKeyup)
    this.node.addEventListener('scroll', boundScroll)
    this.node.addEventListener('select', boundSelect)

    this.node.classList.add(`${ID}-input`, `${ID}-content`)

    this.container = css(this.container, containerProps)
    this.backdrop = css(this.backdrop, backdropProps)
    this.highlights = css(this.highlights, highlightsProps)

    this.backdrop.append(this.highlights)
    this.node.parentNode.insertBefore(this.container, this.node)
    this.container.appendChild(this.node)
    this.node.parentNode.insertBefore(this.backdrop, this.node)

    restoreSelection(this.node)

    this.node.setAttribute('data-multidict-generated', true)

    this.handleSelect()
    this.highlightMistakes()
  }
}

module.exports = { Highlighter }
