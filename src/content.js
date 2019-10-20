const { debounce, getSelectedWordBoundaries } = require('./helpers.js')
const { Highlighter } = require('./deps/highlight/highlight.js')

const editableFields = ['TEXTAREA']

let contentPort = null
let highlighter = null
let editableNode = null
let oldValue = ''

// function is debounced on all keyup and click events
async function edit (event) {
  const target = event.target
  // don't spellcheck non-editable or unsupported fields
  if (!editableFields.includes(target.nodeName) || target.contentEditable === false) {
    return
  }

  // don't spellcheck if text is identical to last spellchecked text
  if (target.getAttribute('data-multidict-generated') && (target.value === oldValue)) {
    return
  }

  // tell background script to connect to active tab if content port undefined
  if (!contentPort) {
    await browser.runtime.sendMessage({ type: 'connectToActiveTab' })
  }

  editableNode = event.target
  oldValue = editableNode.value

  const detectedLanguage = await browser.i18n.detectLanguage(editableNode.value)
  const language = detectedLanguage.isReliable
    ? detectedLanguage.languages[0].language
    : 'unreliable'

  contentPort.postMessage({
    type: 'spellCheck',
    detectedLanguage: language,
    content: editableNode.value
  })
}

// properly resets all values and cleans up leftover html elements on disconnect event
function disconnect (p) {
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
  oldValue = ''
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
      contentPort.postMessage({
        type: message.type,
        word: getSelectedWordBoundaries()[0]
      })
      // clearing oldValue after add/remove ensures we recheck spelling despite identical content
      oldValue = ''
      break

    default:
      console.warn(`MultiDict: unrecognized background message ${JSON.stringify(message)}`)
  }
}

// App Control/Execution Flow
// 1. Page listeners generate Spellings of currently focused/current editable node content
// 2. Single Highlighter instance (requires Spelling) attached to focused/current editable node
// 3. Highlighter instance has own listeners to keep it in sync with editable node and allow user
//    interaction
// 4. Highlighter instance generates WordCarousel (suggestions node) as needed and controls the
//    carousel (WordCarousel does not have own listeners)
//
// Architectural/Design Decisions
// - Helper functions are Class agnostic (helpers can work with a class instance but never
//   instantiate or import/require classes.js)
// - Classes can and do use Helper fuctions/methods during instantiation
// - All clean text for usage in app should be cleaned using core cleanText helper function (with
//   or without specific params)

browser.runtime.onConnect.addListener(connectionHandler)

document.body.addEventListener('keyup', debounce(edit, 700))
document.body.addEventListener('click', debounce(edit, 700))
