/**
 * The Highlighter module inserts itself into the dom behind a textarea. It expects the array of
 * tokens to be ordered and to match the order that text appears inside the textarea. Updating the
 * tokens or color works as expected: the highlighter will not be created anew, but will update it's
 * innerHTML content or CSS styles to ensure each token is properly marked for highlighting.
**/

class Highlighter {
  /**
  * @constructor
  * @param {array} tokens - The tokens (character sequences) to highlight
  * @param {string} color - The RGBA, hexcode, or named CSS color string used to highlight tokens
  * @param {node} textarea - The textarea the highlighter will be attached to
  * @returns {node} Highlighter
  **/
  constructor (textarea, tokens, color, position) {
    this.$textarea = textarea
    this._text = textarea.value
    this._textareaStyles = window.getComputedStyle(textarea)
    this._tokens = tokens
    this._color = color
    this._handleInput = this._handleInput.bind(this)
    this._handleScroll = this._handleScroll.bind(this)
    this._handleStyles = this._handleStyles.bind(this)
    this.render = this.render.bind(this)
    this.destroy = this.destroy.bind(this)
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
      'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'max-height', 'min-height',
      'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'box-sizing'
    ]
    const geometricStyles = ['width', 'height']

    const highlights = this.$highlighter.shadowRoot.querySelector('#highlights')
    const offsetStyles = this._offset(this.$textarea, this.$highlighter)

    // only offset top and left values for non static textareas - otherwise highlight layout breaks
    // (tested on Stackoverflow, Github, and Bugzilla forms/comment fields)
    if (this._textareaStyles.getPropertyValue('position') !== 'static') {
      geometricStyles.unshift('top', 'left')
    }

    reflectedStyles.forEach(style => {
      const value = this._textareaStyles.getPropertyValue(style)
      highlights.style[style] = value
    })

    geometricStyles.forEach(style => {
      highlights.style[style] = offsetStyles[style]
    })
  }

  /**
   * _offset - returns the absolute position and inner size of an element (i.e. clientWidth)
   *
   * @param  {node} element - The element whos absolute position we want to calculate
   * @returns {object} - An object containing the size and coordinates measured in pixels
   */
  _offset (targetNode, offsetNode) {
    const targetRect = targetNode.getBoundingClientRect()
    const offsetRect = offsetNode.getBoundingClientRect()

    // const offsetTop = (rect.top + window.pageYOffset - document.documentElement.clientTop)
    // const offsetLeft = (rect.left + window.pageXOffset - document.documentElement.clientLeft)

    return {
      top: `${targetRect.top - offsetRect.top}px`,
      left: `${targetRect.left - offsetRect.left}px`,
      width: `${targetNode.clientWidth}px`,
      height: `${targetNode.clientHeight}px`
    }
  }

  /**
   * _isWholeWord - searches the text content for an exact match of the given word from the
   * beginning (or elsewhere) of the string. Returns false given the following inputs:
   * _isWholeWord('Shorts and sweets', 'sweet')     -- sweet does not appear as a whole word
   * _isWholeWord('Shorts and sweets', 'Shorts', 1) -- search begins at h so no match
   *
   * @param  {string} word - The sequence of characters we are testing appears as a whole word
   * @param  {string} content - Text content to be tested with regex
   * @param  {number=0} start - Optional index to begin searching content from
   * @returns {boolean} - True if a word appears at least once as a whole word (as of start)
   */

  _isWholeWord (word, content, start = 0) {
    const rxWordBounds = new RegExp(`\\b${word}\\b`)
    return rxWordBounds.test(content.slice(start))
  }

  // generates mark tags for each token found within the current text content
  _generateMarks () {
    let text = this._text
    let index = 0

    for (const token of this.tokens) {
      // continue but don't update search index if we don't find current token inside remaining text
      if (text.indexOf(token, index) === -1) {
        continue
      }
      index = text.indexOf(token, index)
      if (this._isWholeWord(token, text, index)) {
        const markup = `<mark class="color">${token}</mark>`
        const start = index
        const end = index + token.length
        text = text.slice(0, start) + markup + text.slice(end)
        index += markup.length
      }
    }

    // this keeps the highlights aligned if textarea ends with a new line
    text = text.replace(/\n$/, '\n\n')

    // TODO: may have to figure out another way to do this in case Moz rejects the extension
    const highlights = this.$highlighter.shadowRoot.querySelector('#highlights')
    highlights.innerHTML = text
  }

  _setHighlightColor () {
    const marks = this.$highlighter.shadowRoot.querySelectorAll('mark')
    marks.forEach(mark => { mark.style.backgroundColor = this.color })
  }

  // attach event listeners to the textarea that we are monitoring for changes and insert
  // highlighter into DOM, using shadow dom to style and encapsulate it
  _buildHighlighter () {
    this.$highlighter = document.createElement('div')
    this.$highlighter.attachShadow({ mode: 'open' })
    this.$highlighter.shadowRoot.innerHTML = `
    <style>
    :host(div) {
      position: absolute;
    }
    #highlights {
      background: none transparent;
      color: transparent;
      pointer-events: none;
      position: absolute;
      opacity: 35%;
      overflow: hidden;
      white-space: pre-wrap;
      z-index: 1;
    }
    mark {
      border-radius: 15%;
      background-color: ${this.color}33;
      color: transparent;
    }
    mark.color{
      background-color: ${this.color};
    }
    </style>

    <div id="highlights"></div>
    `

    this.$highlighter.setAttribute('class', 'data-multidict-highlights')
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

  // renders the highlighter in full (generates marks, sets highlight color)
  render () {
    this._text = this.$textarea.value
    this._handleStyles()
    this._generateMarks()
    this._handleScroll()
  }
}

module.exports = { Highlighter }
