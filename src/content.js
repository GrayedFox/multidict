const messageHandler = browser.runtime.connect({ name: 'spell-checker' })
const editableFields = ['TEXTAREA']
const { debounce, getText } = require('./helpers.js')
const { highlight } = require('./deps/highlight/highlight.js')

let node

// catches the keyup event on editable fields
// TODO: don't spell check code or other inline editors
async function editable (event) {
  node = event.target

  // only detect language and spellcheck editable fields
  if (!editableFields.includes(node.nodeName) || node.contentEditable === false) {
    return
  }

  const content = getText(node)
  const detectedLanguage = await browser.i18n.detectLanguage(content)

  if (detectedLanguage.isReliable) {
    messageHandler.postMessage({
      name: 'spell-checker',
      language: detectedLanguage.languages[0].language,
      content: content
    })
  } else {
    messageHandler.postMessage({
      name: 'spell-checker',
      language: 'unreliable',
      content: content
    })
  }
}

// background script message object should contain: { spelling, node }
messageHandler.onMessage.addListener((message) => {
  if (message.greeting) {
    console.log(message.greeting)
  }
  if (message.spelling) {
    highlight(node, {
      highlight: message.spelling.misspeltWords,
      className: 'red'
    })
  }
})

// mostly for debugging
messageHandler.onDisconnect.addListener((p) => {
  if (p.error) {
    console.warn(`MultiDict disconnected due to an error: ${p.error.message}`)
  }
})

// TODO: tie click/hover event to showing suggested words instead of spell checking
document.body.addEventListener('keyup', debounce(editable, 1000))
