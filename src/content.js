const {
  cleanWord, debounce, getCurrentWordBounds, getTextContent, isSupported
} = require('./helpers.js')

const { Highlighter } = require('./deps/highlight/highlight.js')

let contentPort = null
let highlighter = null
let editableNode = null
let previousText = ''

// function is debounced on all keyup and click events
async function edit (event) {
  const target = event.target
  const currentText = getTextContent(target, window.location.hostname)

  // don't spellcheck unsupported or uncheckable nodes
  if (!isSupported(target, window.location)) {
    return
  }

  // don't spellcheck if text is identical to last spellchecked text
  if (target.getAttribute('data-multidict-generated') && (currentText === previousText)) {
    return
  }

  // tell background script to connect to active tab if content port falsy
  if (!contentPort) {
    await browser.runtime.sendMessage({ type: 'connectToActiveTab' })
  }

  // update previousText and editableNode after connecting to current/active tab
  editableNode = target
  previousText = currentText

  const detectedLanguage = await browser.i18n.detectLanguage(currentText)
  const language = detectedLanguage.isReliable
    ? detectedLanguage.languages[0].language
    : 'unreliable'

  contentPort.postMessage({
    type: 'spellCheck',
    detectedLanguage: language,
    content: currentText
  })
}

// properly resets all values and cleans up leftover html elements on disconnect event
function disconnect (p) {
  console.log('handle disconnect')
  if (p.error) {
    console.warn(`MultiDict: disconnected due to an error: ${p.error.message}. Please try refreshing the page`)
  }
  if (highlighter) {
    highlighter.destroy()
  }
  contentPort.onMessage.removeListener(messageHandler)
  contentPort.onDisconnect.removeListener(disconnect)
  contentPort = null
  highlighter = null
  previousText = ''
}

// handles incoming connections from the background script (port should update with each tab change)
async function connectionHandler (port, info) {
  if (!contentPort) {
    contentPort = port
    contentPort.onMessage.addListener(messageHandler)
    contentPort.onDisconnect.addListener(disconnect)
  }
}

// handles all incoming messages from the background script
function messageHandler (message) {
  let word = message.word
  switch (message.type) {
    case 'highlight':
      if (highlighter && !editableNode.getAttribute('data-multidict-generated')) {
        highlighter.destroy()
        highlighter = null
      }

      if (!highlighter) {
        highlighter = new Highlighter(editableNode, message.spelling, 'red')
      } else {
        highlighter.setSpelling(message.spelling)
      }
      break

    case 'add':
    case 'remove':
      word = word || getCurrentWordBounds(document.activeElement)[0]
      contentPort.postMessage({
        type: message.type,
        word: cleanWord(word) // always clean the text before adding/removing custom words
      })
      // clearing previousText after add/remove ensures we recheck spelling despite same content
      previousText = ''
      break

    default:
      console.warn(`MultiDict: unrecognized background message ${JSON.stringify(message)}`)
  }
}

browser.runtime.onConnect.addListener(connectionHandler)

document.body.addEventListener('keyup', debounce(edit, 700), true)
document.body.addEventListener('click', debounce(edit, 700), true)

// App Control/Execution Flow
// 1. Page listeners generate Spellings of currently focused textarea/editable node content
// 2. Single Highlighter instance (requires Spelling) attached to textarea/node
// 3. Highlighter instance has own listeners to keep it in sync with textarea/node and allow user
//    interaction
// 4. Highlighter instance generates WordCarousel (suggestions node) as needed and controls the
//    carousel (WordCarousel does not have own listeners, is instead driven by Highlighter)
//
// Architectural/Design Decisions
// - Helper functions are Class agnostic (helpers can work with a class instance but never
//   instantiate or import/require classes.js)
// - Classes can and do use Helper fuctions/methods during instantiation
// - All spellchecked text and custom words should be cleaned with cleanText/cleanWord helper
//   functions (with or without specific params)
