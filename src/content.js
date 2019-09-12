const messageHandler = browser.runtime.connect({ name: 'spell-checker' })
const editableFields = ['TEXTAREA']
const { debounce } = require('./helpers.js')
const { highlight } = require('./deps/highlight/highlight.js')

let node
let oldValue = ''

// listens to all keyup events
async function edit (event) {
  node = event.target

  // don't spellcheck noneditable or unsupported fields
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

// handles all incoming messages from the background script
messageHandler.onMessage.addListener((message) => {
  switch (message.type) {
    case 'greeting':
      console.log(message.greeting)
      break

    case 'spelling':
      highlight(node, {
        highlight: message.spelling.misspeltWords,
        className: 'red'
      })
      break

    case 'add':
    case 'remove':
      if (node.dataset.multidictSelectedText) {
        messageHandler.postMessage({ type: message.type, word: node.dataset.multidictSelectedText })
      }
      break

    default:
      console.warn(`MultiDict: unrecognized background message ${message}`)
  }
})

// mostly for debugging
messageHandler.onDisconnect.addListener((p) => {
  if (p.error) {
    console.warn(`MultiDict disconnected due to an error: ${p.error.message}`)
  }
})

document.body.addEventListener('keyup', debounce(edit, 1000))

// TODO: tie click/hover event to showing suggested words
// ToDo: create context menu item for adding custom words to dictionary via rightclick menu
