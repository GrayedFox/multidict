const messageHandler = browser.runtime.connect({ name: 'spell-checker' })
const editableFields = ['INPUT', 'TEXTAREA', 'DIV']
const { debounce, getText, underline } = require('./helpers.js')

// catches editable fields being clicked on or edited
// TODO: don't spell check code or other inline editors
async function editable (event) {
  const node = event.target

  // only detect language and spellcheck editable fields
  if (!editableFields.includes(node.nodeName) || node.contentEditable === false) {
    return
  }

  const content = getText(node)
  const detectedLanguage = await browser.i18n.detectLanguage(content)

  console.log(node.nodeName)
  console.log(detectedLanguage)

  // for some reason, cannot send node (event.target) in message. Size restriction?
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
    underline(message.spelling.misspeltWords, message.hello)
  }
})

messageHandler.onDisconnect.addListener((p) => {
  if (p.error) {
    console.log(`Disconnected due to an error: ${p.error.message}`)
  }
})

// BUG: click event listener sends single line of text instead of content of entire editable field
// TODO: tie click event to suggesting words instead of spell checking
document.body.addEventListener('click', debounce(editable, 1200))
document.body.addEventListener('keyup', debounce(editable, 1200))

// inject a listener which triggers from focus event on editable fields
// detect language of content within field
// send a message containing the text to spell check using background.js dictionary
// OR send 'unreliable' and fallback to primary user dictionary
