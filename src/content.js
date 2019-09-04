const messageHandler = browser.runtime.connect({ name: 'spell-checker' })
const editableFields = ['TEXTAREA']
const { debounce, getText } = require('./helpers.js')
const { highlight } = require('./deps/highlight/highlight-within-textarea.js')

let node

// catches editable fields being clicked on or edited
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
  console.log('Got message from background...')
  console.log(message)
  if (message.spelling) {
    highlight(node, {
      highlight: message.spelling.misspeltWords,
      className: 'red'
    })
  }
})

messageHandler.onDisconnect.addListener((p) => {
  if (p.error) {
    console.log(`Disconnected due to an error: ${p.error.message}`)
  }
})

// BUG: click event listener sends single line of text instead of content of entire editable field
// TODO: tie click event to showing suggested words instead of spell checking
// document.body.addEventListener('click', debounce(word, 200))
document.body.addEventListener('keyup', debounce(editable, 1200))

// injects a keyup listener for spell checking words, which then highlights misspelt words
