const { blinkMark, debounce, getAllChildren, isSupported, offsetBy, setAllAttribute, setStyleValues } = require('./helpers')
const { getCurrentMark, getCurrentWordBounds, getMatchingMarkIndex, getSelectionBounds, getTextContent, replaceInText, storeSelection } = require('./text-methods')
const { Word } = require('./classes')
const { Carousel } = require('./carousel')
const { Highlighter } = require('./highlighter')

const dataGenString = 'data-multidict-native-spellcheck-disabled'
const observer = new MutationObserver(handleDOMChanges)
const currentLanguage = { lang: '', isReliable: false }

let carousel = null
let highlightColor = null
let currentSpelling = null
let currentTextarea = null
let highlighter = null
let previousSpellcheckedText = ''
let settings = null

// replace the text inside the target node with
function chooseSuggestion (node, suggestion, word) {
  console.log('choose suggestion')
  const currentText = getTextContent(node)
  const restoreSelection = storeSelection(getSelectionBounds(node))

  node.value = replaceInText(currentText, word, suggestion)
  restoreSelection(node)
  handleHighlight()
}

// detect and update currentLanguage
async function updateDetectedLanguage (text) {
  const detectedLanguage = await browser.i18n.detectLanguage(text)
  currentLanguage.isReliable = detectedLanguage.isReliable
  currentLanguage.lang = (currentLanguage.isReliable)
    ? detectedLanguage.languages[0].language
    : 'unreliable'
}

// ask background script to generate a Spelling
function getSpelling (currentText) {
  browser.runtime.sendMessage({
    type: 'getSpelling',
    detectedLanguage: currentLanguage.lang,
    content: currentText
  })
}

// spellcheck function debounced on all keyup and click events
function spellcheck (event) {
  console.log('handle spellcheck')
  const node = event.target
  const currentText = getTextContent(node)

  // don't spellcheck unsupported nodes
  if (!isSupported(node)) {
    return
  }

  // don't spellcheck if text is identical to last spellchecked text
  if (node.getAttribute('data-multidict-current') && (currentText === previousSpellcheckedText)) {
    return
  }

  // need to detect laguage again if we have changed nodes (or are still waiting for click result)
  if (!currentLanguage.isReliable || (currentTextarea !== node)) {
    updateDetectedLanguage(currentText).then(() => getSpelling(currentText))
  } else {
    getSpelling(currentText)
  }

  // update previousSpellcheckedText
  previousSpellcheckedText = currentText
}

// update current mark and currently selected word based on caret position
function updateCurrentTextarea (node) {
  console.log('update current textarea')
  if (currentTextarea) currentTextarea.removeAttribute('data-multidict-selected-word')
  updateDetectedLanguage(getTextContent(node))
  currentTextarea = node
  const word = new Word(...getCurrentWordBounds(node))
  node.setAttribute('data-multidict-selected-word', [...word])
}

// detect content language when user clicks and update current selection
function handleClick (event) {
  console.log('handle click')
  const node = event.target
  if (!isSupported(node)) {
    return
  }

  updateCurrentTextarea(node)
}

// watch for dom content changes and do necessary work
function handleDOMChanges (mutationList, observer) {
  console.log('handle dom changes')
  // watch for additional textareas added to DOM and apply user settings
  if (settings.disableNativeSpellcheck) {
    mutationList.forEach((mutation) => {
      if (!mutation.target.hasAttribute(dataGenString)) {
        const textareas = getAllChildren(mutation.addedNodes)
          .filter(node => node.nodeName === 'TEXTAREA' && !node.hasAttribute(dataGenString))
        handleSettings(textareas)
      }
    })
  }
}

// highlight misspelt words based on given tokens. This function can be called without any params to
// get the highlighter instance to re-render
function handleHighlight (tokens) {
  console.log('handle highlight')
  if (highlighter && !currentTextarea.getAttribute('data-multidict-current')) {
    highlighter.destroy()
    highlighter = null
  }

  try {
    if (!highlighter && currentTextarea) {
      highlighter = new Highlighter(currentTextarea, tokens, highlightColor, 'multidict')
    } else {
      highlighter.tokens = tokens || highlighter.tokens
    }
  } catch (e) {
    console.error(e)
  }
}

// handle rotating the carousel
function handleCarousel (event, direction) {
  console.log('handle carousel')
  const word = new Word(...getCurrentWordBounds(currentTextarea))
  const currentMarkIndex = getMatchingMarkIndex(getTextContent(currentTextarea), word)
  const mark = getCurrentMark(word.text, currentMarkIndex, highlighter)
  const suggestions = currentSpelling.suggestions[word.text]
  const misspeltWord = currentSpelling.misspeltWords[currentMarkIndex]
  // if we are showing the carousel but shift and alt are no longer pressed replace the word with
  // the chosen cell/suggestion
  if (carousel && !(event.shiftKey && event.altKey)) {
    chooseSuggestion(currentTextarea, carousel.currentCell.textContent, word)
    carousel.destroy()
    carousel = null
    setStyleValues(mark, { visibility: null })
    setStyleValues(currentTextarea, { filter: null })
  }

  if (event.shiftKey && event.altKey && direction) {
    // we create a carousel when we get a directional keypress (up arrow, down arrow)
    if (direction === 'up' || direction === 'down') {
      // if we have suggestions and no carousel present, create one using the word suggestions
      if (!carousel && suggestions) {
        const position = offsetBy(mark, currentTextarea)
        const topSuggestions = suggestions.suggestedWords
        setStyleValues(currentTextarea, { filter: 'blur(1px)' })
        setStyleValues(mark, { visibility: 'hidden' })
        carousel = new Carousel(currentTextarea, topSuggestions, mark.offsetHeight, position)
      }
      // if we have no suggestions but the current word is misspelt, blink current mark
      if (!suggestions && misspeltWord && mark) {
        blinkMark(mark, 4, 600)
      }
      // rotate the carousel up or down
      if (carousel) {
        carousel.rotate(direction)
      }
    } else {
      // if direction is left or right, destroy the carousel without replacing text so user can
      // navigate away from carousel without choosing a suggestion
      if (carousel && carousel.visible) {
        carousel.destroy()
        carousel = null
        setStyleValues(mark, { visibility: null })
        setStyleValues(currentTextarea, { filter: null })
      }
    }
  }
}

// handle keyup events of textarea, used to drive carousel/word suggestions behaviour
function handleKeyup (event) {
  console.log('handle keyup')
  const directions = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' }
  const direction = directions[event.keyCode]
  const node = event.target

  if (!isSupported(node)) {
    return
  }

  // don't update current text are or detect language while carousel showing
  if (!carousel) {
    updateCurrentTextarea(node)
  }

  // handle carousel if user holding shift+alt+direction or when they release the alt or shift keys
  if ((direction && event.shiftKey && event.altKey) || event.key === 'Alt' || event.key === 'Shift') {
    handleCarousel(event, direction)
  }
}

// handle refreshing any vars/temp settings if needed before triggering a recheck or color change
function handleRefresh (message) {
  console.log('handle refresh')
  switch (message.content.type) {
    case 'add':
    case 'remove':
      // clearing previousSpellcheckedText ensures we recheck spelling despite identical content
      previousSpellcheckedText = ''
      spellcheck({ target: currentTextarea })
      break
    case 'color':
      highlightColor = message.content.color
      highlighter.rebuild()
      break
    case 'preview':
      highlighter.color = message.content.color
      break
    default:
      console.warn('MultiDict: unrecognized refresh type', message.content.type)
      break
  }
}

// apply current user settings to applicable nodes
function handleSettings (nodeList) {
  // set spellcheck=false on all text fields to prevent double spell checking
  if (settings.disableNativeSpellcheck && nodeList.length > 0) {
    console.log('handle settings')
    setAllAttribute(nodeList, 'spellcheck', false)
    setAllAttribute(nodeList, dataGenString)
  }
}

// handle adding or removing word to/from personal dictionary
function handleWord (message) {
  let word = message.content.word
  // if word undefined generate word from current selection/cursor position
  word = word || getCurrentWordBounds(document.activeElement)[0]
  browser.runtime.sendMessage({ type: message.type, word: word })
}

// handles all incoming messages from the background script
function messageHandler (message) {
  switch (message.type) {
    case 'highlight':
      currentSpelling = message.content
      handleHighlight(message.content.misspeltStrings)
      break
    case 'add':
    case 'remove':
      handleWord(message)
      break
    case 'gotCustomColor':
      highlightColor = message.content.color
      break
    case 'gotCustomSettings':
      settings = message.content
      handleSettings(document.querySelectorAll('textarea'))
      break
    case 'refresh':
      handleRefresh(message)
      break

    default:
      console.warn(`MultiDict: unrecognized background message ${JSON.stringify(message)}`)
  }
}

function main () {
  if (!browser.runtime.onMessage.hasListener(messageHandler)) {
    browser.runtime.onMessage.addListener(messageHandler)
  }

  // don't add listeners if body already has them
  if (!document.body.getAttribute('data-multidict-listening')) {
    document.body.addEventListener('click', handleClick)
    document.body.addEventListener('click', debounce(spellcheck, 700), true)
    document.body.addEventListener('keyup', handleKeyup)
    document.body.addEventListener('keyup', debounce(spellcheck, 700), true)
    document.body.setAttribute('data-multidict-listening', true)
  }

  browser.runtime.sendMessage({ type: 'getCustomSettings' })
  browser.runtime.sendMessage({ type: 'getCustomHighlightColor' })
  observer.observe(document.body, { childList: true, subtree: true })
}

main()

// App Control/Execution Flow
// 1. spellcheck listener generate Spellings of currently focused textarea node content
// 2. Single Highlighter instance (requires Spelling) per page per focused textarea
// 3. Highlighter instance has own listeners to keep it in sync with textarea node
// 4. Content script drives the Carousel (suggestions) as needed; Carousel does not have own
//    listeners but has a rotate method for rotating the carousel
// 5. Content script keeps track of where the caret/cursor position is inside of focused textarea,
//    which is used when generating a Carousel
//
// Architectural/Design Decisions
// - Helper functions are Class agnostic (helpers can work with a class instance but never
//   instantiate or import/require classes.js)
// - Classes can and do use Helper fuctions/methods during instantiation
// - All spellchecked text and custom words should be cleaned with cleanText/cleanWord helper
//   functions (with or without specific params)
// - Carousel and Highlighter instances function indepdently of eachother, however a Highlighter
//   needs a textarea and a Carousel needs a parent element and position to be placed correctly
