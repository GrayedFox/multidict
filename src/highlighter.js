const { isWholeWord } = require('./text-methods')

/**
 * Class representing a highlighter. It inserts itself into the dom behind a textarea. It expects
 * the array of tokens to be ordered and to match the order that text appears inside the textarea.
 * Updating the tokens or color works as expected: the highlighter will not be created anew, but
 * will update it's innerHTML content or CSS styles to ensure each token is properly marked for
 * highlighting.
**/
class Highlighter {
  /**
  * Create a Highligher
  *
  * @param {node} textarea - The textarea the highlighter will be attached to
  * @param {string[]} tokens - The tokens (character sequences) to highlight
  * @param {string} color - The 6 digit hexcode color string used for highlighting tokens
  **/
  constructor (textarea, tokens, color) {
    this.$textarea = textarea
    this._text = textarea.value
    this._textareaStyles = window.getComputedStyle(textarea)
    this._tokens = tokens
    this._color = color
    this._handleInput = this._handleInput.bind(this)
    this._handleScroll = this._handleScroll.bind(this)
    this._handleStyles = this._handleStyles.bind(this)
    this.render = this.render.bind(this)
    this.rebuild = this.rebuild.bind(this)
    this.destroy = this.destroy.bind(this)
    this.$highlights = null
    this.$highlighter = null

    this._buildHighlighter()
  }

  get color () {
    return this._color
  }

  set color (color) {
    this._color = color
    this._setHighlightColor()
  }

  get tokens () {
    return this._tokens
  }

  set tokens (tokens) {
    this._tokens = tokens
    this.render()
  }

  // text is copied from textarea to highlighter instance during render
  _handleInput (event) {
    this.render()
  }

  // handle keeping highlight scroll in sync wiht textarea
  _handleScroll (event) {
    if (this.$textarea.scrollTop) {
      this.$highlighter.shadowRoot.querySelector('div').scrollTop = this.$textarea.scrollTop
    }
  }

  // copy desired styles from textarea and reflect them to highlights node
  _handleStyles () {
    const reflectedStyles = [
      'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
      'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
      'font-size', 'font-family', 'font-weight', 'line-height', 'letter-spacing', 'text-align',
      'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'box-sizing',
      'max-height', 'min-height'
    ]
    const geometricStyles = ['width', 'height']
    const offsetStyles = this._offset(this.$textarea, this.$highlighter)

    // only offset top and left values for non static textareas - otherwise highlight layout breaks
    // (tested on Stackoverflow, Github, and Bugzilla forms/comment fields)
    if (this._textareaStyles.getPropertyValue('position') !== 'static') {
      geometricStyles.unshift('top', 'left')
    }

    reflectedStyles.forEach(style => {
      const value = this._textareaStyles.getPropertyValue(style)
      this.$highlights.style[style] = value
    })

    geometricStyles.forEach(style => {
      this.$highlights.style[style] = offsetStyles[style]
    })
  }

  /**
   * _offset - returns the absolute position and inner size of an element
   *
   * @param  {node} targetNode - The element whos absolute position we want to calculate
   * @param  {node} offsetNode - The element whos position we offset by the targetNode
   * @returns {object} - An object containing the size and coordinates measured in pixels
   */
  _offset (targetNode, offsetNode) {
    const targetRect = targetNode.getBoundingClientRect()
    const offsetRect = offsetNode.getBoundingClientRect()

    return {
      top: `${targetRect.top - offsetRect.top}px`,
      left: `${targetRect.left - offsetRect.left}px`,
      width: `${targetNode.clientWidth}px`,
      height: `${targetNode.clientHeight}px`
    }
  }

  /**
   * _isWholeWord - private wrapper of isWholeWord
   *
   * @see TextMethods.isWholeWord
   */
  _isWholeWord (word, content, start = 0) {
    return isWholeWord(word, content, start)
  }

  // appends a mark to the end of a node
  _appendMark (node, token) {
    const mark = document.createElement('mark')
    mark.classList.add('color')
    mark.textContent = token
    node.appendChild(mark)
  }

  // appends a chunk of text to a node
  _appendText (node, text, start, end) {
    node.appendChild(document.createTextNode(text.slice(start, end)))
  }

  // generates mark tags for each token found within the current text content
  _generateMarks () {
    let text = this._text
    let searchIndex = 0
    let previousIndex = 0
    let done = false
    let i = 0

    const fragment = new DocumentFragment()

    while (!done) {
      const token = this._tokens[i]
      // if there are no more tokens, we are done highlighting
      if (i === this._tokens.length) {
        done = true
        continue
      }

      // skip current token if we don't find it inside remaining text
      if (text.indexOf(token, searchIndex) === -1) {
        i++
        continue
      }

      searchIndex = text.indexOf(token, searchIndex)
      this._appendText(fragment, text, previousIndex, searchIndex)
      if (this._isWholeWord(token, text, searchIndex)) {
        this._appendMark(fragment, token)
        i++
      } else {
        this._appendText(fragment, text, searchIndex, searchIndex + token.length)
      }
      searchIndex += token.length
      previousIndex = searchIndex
    }

    // this keeps the highlights aligned if textarea ends with a new line
    text = text.replace(/\n$/, '\n\n')

    while (this.$highlights.firstChild) this.$highlights.removeChild(this.$highlights.firstChild)
    this.$highlights.appendChild(fragment)
  }

  // this will update the currently displayed highlight color only (the original innerHTML will
  // still reference the color used to instantiate the class)
  _setHighlightColor () {
    const marks = this.$highlighter.shadowRoot.querySelectorAll('mark')
    marks.forEach(mark => { mark.style.backgroundColor = this.color })
  }

  // return the template used for building the highlighter
  _getInnerHtmlTemplate () {
    return `
    <style>
    :host(div) {
      position: absolute;
    }
    #highlights {
      background: none transparent;
      border-color: transparent;
      color: transparent;
      pointer-events: none;
      position: absolute;
      overflow: hidden;
      white-space: pre-wrap;
      z-index: 1;
    }
    mark {
      border-radius: 0.5em;
      background-color: ${this.color}33;
      color: transparent;
      opacity: 35%;
    }
    mark.color{
      background-color: ${this.color};
    }
    </style>

    <div id="highlights"></div>
    `
  }

  // attach event listeners to the textarea that we are monitoring for changes and insert
  // highlighter into DOM, using shadow dom to style and encapsulate it
  _buildHighlighter () {
    this.$highlighter = document.createElement('div')
    this.$highlighter.attachShadow({ mode: 'open' })
    this.$highlighter.setAttribute('class', 'data-multidict-highlights')
    this.$highlighter.shadowRoot.innerHTML = this._getInnerHtmlTemplate()
    this.$highlights = this.$highlighter.shadowRoot.querySelector('#highlights')
    this.$textarea.setAttribute('data-multidict-current', true)
    this.$textarea.addEventListener('input', this._handleInput)
    this.$textarea.addEventListener('scroll', this._handleScroll)
    this.$textarea.insertAdjacentElement('beforebegin', this.$highlighter)

    this._observer = new MutationObserver((mutations) => {
      mutations.forEach((mutationRecord) => {
        this._handleStyles()
      })
    })

    // observe all style changes of textarea
    this._observer.observe(this.$textarea, { attributes: true, attributeFilter: ['style'] })

    this.render()
  }

  destroy () {
    this._observer.disconnect()
    this.$textarea.removeAttribute('data-multidict-current')
    this.$textarea.removeEventListener('input', this._handleInput)
    this.$textarea.removeEventListener('scroll', this._handleScroll)
    this.$highlighter.remove()
  }

  // rebuild the innerHTML content of the highlighter (for when color is out of sync)
  rebuild () {
    this.$highlighter.shadowRoot.innerHTML = this._getInnerHtmlTemplate()
    this.$highlights = this.$highlighter.shadowRoot.querySelector('#highlights')
    this.render()
  }

  // renders the highlighter in full (generates marks, sets highlight color)
  render () {
    this._text = this.$textarea.value
    this._handleStyles()
    this._generateMarks()
    this._handleScroll()
  }
}

module.exports = { Highlighter }
