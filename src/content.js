const { blinkMark, debounce, getAllChildren, isSupported, setNodeListAttributes } = require('./helpers')
const {
  getCurrentMark, getCurrentWordBounds, getMatchingMarkIndex, getSelectionBounds, getTextContent,
  getMisspeltWordIndex, replaceInText, storeSelection
} = require('./text-methods')
const { SuggestionTracker, Word } = require('./classes')
const { Highlighter } = require('./highlighter')

const dataGenString = 'data-multidict-native-spellcheck-disabled'
const observer = new MutationObserver(handleDOMChanges)
const currentLanguage = { lang: '', isReliable: false }

let suggestionTracker = null
let highlightColor = null
let currentSpelling = null
let currentTextarea = null
let highlighter = null
let settings = null
let maxSuggestions = null
let originalMarkIndex = null
let originalWord = null
let originalText = ''
let previousSpellcheckedText = ''

function init () {
  if (!browser.runtime.onMessage.hasListener(messageHandler)) {
    browser.runtime.onMessage.addListener(messageHandler)
  }

  // don't add listeners if body already has them
  if (!document.body.getAttribute('data-multidict-listening')) {
    document.body.addEventListener('click', handleClick)
    document.body.addEventListener('click', debounce(spellcheck, 400), true)
    document.body.addEventListener('keyup', handleKeyup)
    document.body.addEventListener('keyup', debounce(spellcheck, 700), true)
    document.body.setAttribute('data-multidict-listening', true)
  }

  browser.runtime.sendMessage({ type: 'getMaxSuggestions' })
  browser.runtime.sendMessage({ type: 'getSettings' })
  browser.runtime.sendMessage({ type: 'getColor' })
  observer.observe(document.body, { childList: true, subtree: true })
}

// handles all incoming messages from the background script
function messageHandler (message) {
  switch (message.type) {
    case 'highlight':
      currentSpelling = message.content
      handleHighlight()
      break
    case 'addCustomWord':
    case 'removeCustomWord':
      handleWord(message)
      break
    case 'gotCustomColor':
      highlightColor = message.content.color
      break
    case 'gotCustomSettings':
      settings = message.content
      handleSettings(document.querySelectorAll('textarea'))
      break
    case 'gotMaxSuggestions':
      maxSuggestions = message.content.maxSuggestions
      break
    case 'refresh':
      handleRefresh(message)
      break

    default:
      console.warn(`Multidict: unrecognized background message ${JSON.stringify(message)}`)
  }
}

// handle refreshing any variables/temp settings and trigger a recheck or color change if needed
function handleRefresh (message) {
  switch (message.content.type) {
    case 'recheck':
      // clearing previousSpellcheckedText ensures we recheck spelling despite identical content
      previousSpellcheckedText = ''
      if (currentTextarea) spellcheck({ target: currentTextarea })
      break
    case 'color':
      highlightColor = message.content.color
      if (highlighter) highlighter.rebuild()
      break
    case 'preview':
      if (highlighter) highlighter.color = message.content.color
      break
    case 'render':
      if (highlighter) highlighter.render()
      break
    case 'suggestions':
      maxSuggestions = message.content.maxSuggestions
      break
    case 'settings':
      settings = message.content.customSettings
      handleSettings(document.querySelectorAll('textarea'))
      break
    default:
      console.warn('Multidict: unrecognized refresh type', message.content.type)
      break
  }
}

// spellcheck function debounced on all keyup and click events
function spellcheck (event) {
  const node = event.target
  const currentText = getTextContent(node)

  // don't spellcheck unsupported nodes or spellcheck when user cycling suggestions
  if (!isSupported(node) || suggestionTracker) {
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

// highlight misspelt words based on the current spelling
function handleHighlight (words = currentSpelling.misspeltStrings) {
  if (highlighter && !currentTextarea.getAttribute('data-multidict-current')) {
    highlighter.destroy()
    highlighter = null
  }

  try {
    if (!highlighter && currentTextarea) {
      highlighter = new Highlighter(currentTextarea, words, highlightColor, 'multidict')
    } else {
      highlighter.tokens = words
    }
  } catch (e) {
    console.error(e)
  }
}

// handle cycling through suggestions
function handleSuggestions (event, direction) {
  if (!highlighter) return // small chance this function is called before highlighter instantiated
  const word = new Word(...getCurrentWordBounds(currentTextarea))
  const currentMarkIndex = getMatchingMarkIndex(getTextContent(currentTextarea), word)
  const mark = getCurrentMark(word.text, currentMarkIndex, highlighter)
  const suggestions = currentSpelling.suggestions[word.text]
  const misspeltWord = currentSpelling.misspeltWords[currentMarkIndex]

  let topSuggestions

  if (suggestions) {
    // topSuggestions based on user specified limit (defaults to 6). A maxSuggestions setting of 10
    // means don't limit the suggestions, a setting of 0 means don't show suggestions
    topSuggestions = maxSuggestions !== 0 && maxSuggestions !== 10
      ? suggestions.suggestedWords.slice(0, maxSuggestions)
      : suggestions.suggestedWords
  }

  // if we are cycling suggestions but shift and alt are no longer pressed destroy tracker
  if (suggestionTracker && !(event.shiftKey && event.altKey)) {
    suggestionTracker = null
  }

  if (event.shiftKey && event.altKey && direction) {
    // we create a suggestionTracker when we get a directional keypress (up or down arrow)
    if (direction === 'up' || direction === 'down') {
      // if we have suggestions and user wants them, and no suggestionTracker is present, create one
      if (!suggestionTracker && topSuggestions && topSuggestions.length > 0 && maxSuggestions > 0) {
        // keep reference of original text, word, and mark index
        originalText = getTextContent(currentTextarea)
        originalWord = word
        originalMarkIndex = getMisspeltWordIndex(word, currentSpelling, currentMarkIndex)
        // remove misspelt word from misspeltStrings array
        currentSpelling.misspeltStrings.splice(originalMarkIndex, 1)
        // ensures that suggestion with closest proximity to misspelt word is at second index
        topSuggestions.unshift(topSuggestions.pop())
        suggestionTracker = new SuggestionTracker(topSuggestions)
      }
      // if we have no suggestions but the current word is misspelt, blink current mark
      if ((misspeltWord && mark) && (maxSuggestions === 0 || !topSuggestions)) {
        blinkMark(mark, 4, 600)
      }
      // cycle through suggestionTracker up or down and replace the word with the suggestion
      if (suggestionTracker) {
        suggestionTracker.rotate(direction)
        chooseSuggestion(currentTextarea, suggestionTracker.currentSuggestion, word)
      }
    } else {
      // if direction left or right, destroy tracker and restore original text and spelling
      if (suggestionTracker) {
        suggestionTracker = null
        const restoreSelection = storeSelection(getSelectionBounds(currentTextarea))
        currentSpelling.misspeltStrings.splice(originalMarkIndex, 0, originalWord.text)
        currentTextarea.value = originalText
        restoreSelection(currentTextarea)
        handleHighlight()
      }
    }
  }
}

// replace the text inside the target node with the chosen suggestion
function chooseSuggestion (node, suggestion, word) {
  const currentText = getTextContent(node)
  const restoreSelection = storeSelection(getSelectionBounds(node))

  node.value = replaceInText(currentText, word, suggestion)
  restoreSelection(node)
  handleHighlight()
}

// handle keyup events of textarea, used to instantiate or cycle suggestionTracker
function handleKeyup (event) {
  const directions = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' }
  const direction = directions[event.keyCode]
  const node = event.target

  if (!isSupported(node)) {
    return
  }

  // don't update current textarea or detect language while cycling suggestions
  if (!suggestionTracker) {
    updateCurrentTextarea(node)
  }

  // handle suggestions when shift+alt+direction or when user releases the alt or shift keys
  if ((direction && event.shiftKey && event.altKey) || event.key === 'Alt' || event.key === 'Shift') {
    handleSuggestions(event, direction)
  }
}

// apply current user settings to applicable nodes
function handleSettings (nodeList) {
  // set spellcheck=false on all text fields to prevent double spell checking
  if (settings.includes('disableNativeSpellcheck') && nodeList.length > 0) {
    setNodeListAttributes(nodeList, { spellcheck: false, [dataGenString]: true })
  } else {
    setNodeListAttributes(nodeList, { spellcheck: null, [dataGenString]: false })
  }
}

// handle adding or removing word to/from personal dictionary
function handleWord (message) {
  let word = message.content.word
  // if word undefined generate word from current selection/cursor position
  word = word || getCurrentWordBounds(document.activeElement)[0]
  browser.runtime.sendMessage({ type: message.type, word: word })
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

// update current mark and currently selected word based on caret position
function updateCurrentTextarea (node) {
  if (currentTextarea) currentTextarea.removeAttribute('data-multidict-selected-word')
  updateDetectedLanguage(getTextContent(node))
  currentTextarea = node
  const word = new Word(...getCurrentWordBounds(node))
  node.setAttribute('data-multidict-selected-word', [...word])
}

// detect content language when user clicks and update current selection
function handleClick (event) {
  const node = event.target
  if (!isSupported(node)) {
    return
  }

  updateCurrentTextarea(node)
}

// watch for dom content changes and do necessary work
function handleDOMChanges (mutationList, observer) {
  // watch for additional textareas added to DOM and apply user settings
  if (settings && settings.includes('disableNativeSpellcheck')) {
    mutationList.forEach((mutation) => {
      const textareas = getAllChildren(mutation.addedNodes)
        .filter(node => node.nodeName === 'TEXTAREA' && !node.hasAttribute(dataGenString))
      handleSettings(textareas)
    })
  }
}

init()

// App Control/Execution Flow
// 1. spellcheck listener generate Spellings of currently focused textarea node content
// 2. Single Highlighter instance (requires Spelling) per page per focused textarea
// 3. Highlighter instance has own listeners to keep it in sync with textarea node
// 4. Content script drives the suggestions as needed; SuggestionTracker does not have own listeners
//    but has a rotate method for cycling through and tracking shown suggestion
// 5. Content script keeps track of where the caret/cursor position is inside of focused textarea,
//    which is used when placing suggestions or adding/removing a word
//
// Architectural/Design Decisions
// - Helper functions are Class agnostic (helpers can work with a class instance but never
//   instantiate or import/require classes.js)
// - Classes can and do use Helper fuctions/methods during instantiation
// - All spellchecked text and custom words should be cleaned with cleanText/cleanWord helper
//   functions (with or without specific params)
// - SuggestionTracker and Highlighter classes function indepdently of eachother, however a
//   Highlighter needs a textarea to be positioned correctly
