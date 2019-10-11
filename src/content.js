const { debounce, getSelectedWord } = require('./helpers.js')
const { highlight } = require('./deps/highlight/highlight.js')

const messageHandler = browser.runtime.connect({ name: 'spell-checker' })
const editableFields = ['TEXTAREA']

let node
let oldValue = ''

// listens to all keyup events
async function edit (event) {
  node = event.target

  // don't spellcheck non-editable or unsupported fields
  if (!editableFields.includes(node.nodeName) || node.contentEditable === false) {
    return
  }

  // don't spellcheck if text is identical to last spellchecked text
  if (node.getAttribute('data-multidict-generated') && (node.value === oldValue)) {
    return
  }

  oldValue = node.value

  const detectedLanguage = await browser.i18n.detectLanguage(node.value)
  const language = detectedLanguage.isReliable
    ? detectedLanguage.languages[0].language
    : 'unreliable'

  messageHandler.postMessage({
    type: 'check',
    detectedLanguage: language,
    content: node.value
  })
}

// listens to all incoming messages from the background script
messageHandler.onMessage.addListener((message) => {
  switch (message.type) {
    case 'greeting':
      console.log(message.greeting)
      break

    case 'highlight':
      highlight(node, {
        misspeltWords: message.spelling.misspeltWords,
        suggestions: message.spelling.suggestions,
        className: 'red'
      })
      break

    case 'add':
    case 'remove':
      messageHandler.postMessage({
        type: message.type,
        word: getSelectedWord().text
      })
      break

    default:
      console.warn(`MultiDict: unrecognized background message ${message}`)
  }
})

// for debugging purposes, log disconnect error
messageHandler.onDisconnect.addListener((p) => {
  if (p.error) {
    console.warn(`MultiDict: disconnected due to an error: ${p.error.message}. Please try refreshing the page`)
  }
})

document.body.addEventListener('keyup', debounce(edit, 700))
document.body.addEventListener('click', debounce(edit, 700))
