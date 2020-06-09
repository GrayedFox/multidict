const {
  debounce, disableNativeSpellcheck, getCssSelector, getCurrentWordBounds, getTextContent, isSupported
} = require('./helpers.js')

const { Highlighter } = require('./deps/highlight/highlight.js')

let highlighter = null
let editableNode = null
let previousText = ''
let settings = null

// watch for dom content changes and do necessary work
function handleChanges (mutationList, observer) {
  // watch for additional textareas added to DOM and apply settings
  if (settings.disableNativeSpellcheck) {
    mutationList.forEach((mutation) => {
      // nodeLists don't have a length property, so we check if 1st item is truthy
      if (mutation.type === 'childList' && mutation.addedNodes[0]) {
        const selector = getCssSelector(mutation.target)
        const textareas = document.querySelectorAll(`${selector} textarea`)
        if (textareas[0]) {
          disableNativeSpellcheck(textareas)
        }
      }
    })
  }
}

// handle highlighting misspelt words based on recieved spelling
function handleHighlight (spelling) {
  if (highlighter && !editableNode.getAttribute('data-multidict-generated')) {
    highlighter.destroy()
    highlighter = null
  }

  if (!highlighter) {
    highlighter = new Highlighter(editableNode, spelling, 'red')
  } else {
    highlighter.setSpelling(spelling)
  }
}

// handle refreshing any vars/temp settings if needed
function handleRefresh () {
  // clearing previousText after ensures we recheck spelling despite identical content
  previousText = ''
}

// handle any user settings
function handleSettings (newSettings) {
  settings = newSettings
  // set spellcheck=false on all text fields to prevent double spell checking
  if (settings.disableNativeSpellcheck) {
    disableNativeSpellcheck(document.querySelectorAll('textarea'))
  }
}

// handle adding or removing word to personal dictionary
function handleWord (message) {
  let word = message.content.word
  // if word undefined generate word from current selection/cursor position
  word = word || getCurrentWordBounds(document.activeElement)[0]
  browser.runtime.sendMessage({ type: message.type, word: word })
}

// edit function debounced on all keyup and click events
async function edit (event) {
  const target = event.target
  const currentText = getTextContent(target, window.location.hostname)

  // don't spellcheck unsupported nodes
  if (!isSupported(target, window.location)) {
    return
  }

  // don't spellcheck if text is identical to last spellchecked text
  if (target.getAttribute('data-multidict-generated') && (currentText === previousText)) {
    return
  }

  // update previousText and editableNode after connecting to current/active tab
  editableNode = target
  previousText = currentText

  const detectedLanguage = await browser.i18n.detectLanguage(currentText)
  const language = detectedLanguage.isReliable
    ? detectedLanguage.languages[0].language
    : 'unreliable'

  browser.runtime.sendMessage({
    type: 'spellCheck',
    detectedLanguage: language,
    content: currentText
  })
}

// handles all incoming messages from the background script
function messageHandler (message) {
  switch (message.type) {
    case 'highlight':
      handleHighlight(message.content)
      break
    case 'add':
    case 'remove':
      handleWord(message)
      break
    case 'getCustomSettings':
      handleSettings(message.content)
      break
    case 'refresh':
      handleRefresh()
      break

    default:
      console.warn(`MultiDict: unrecognized background message ${JSON.stringify(message)}`)
  }
}

function main () {
  // don't add listener if one already present -- test how this works with multiple tabs
  if (!browser.runtime.onMessage.hasListener(messageHandler)) {
    browser.runtime.onMessage.addListener(messageHandler)
  }

  // ask for custom settings (handled by message handler)
  browser.runtime.sendMessage({ type: 'getCustomSettings' })

  // don't add listeners if body already has them
  if (!document.body.getAttribute('data-multidict-listening')) {
    document.body.addEventListener('keyup', editListener, true)
    document.body.addEventListener('click', editListener, true)
    document.body.setAttribute('data-multidict-listening', true)
  }
}

const editListener = debounce(edit, 700)
const observer = new MutationObserver(handleChanges)
observer.observe(document.body, { childList: true, subtree: true })

main()

// App Control/Execution Flow
// 1. Page listeners generate Spellings of currently focused textarea node content
// 2. Single Highlighter instance (requires Spelling) per page attached to active textarea
// 3. Highlighter instance has own listeners to keep it in sync with textarea node and allow
//    user interaction
// 4. Highlighter instance generates WordCarousel (suggestions node) as needed and controls the
//    carousel (WordCarousel does not have own listeners, is instead driven by Highlighter)
//
// Architectural/Design Decisions
// - Helper functions are Class agnostic (helpers can work with a class instance but never
//   instantiate or import/require classes.js)
// - Classes can and do use Helper fuctions/methods during instantiation
// - All spellchecked text and custom words should be cleaned with cleanText/cleanWord helper
//   functions (with or without specific params)
