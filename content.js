const messageHandler = browser.runtime.connect({ name: 'spell-checker' })
const editableFields = ['INPUT', 'TEXTAREA', 'DIV']

// sexy es6 debounce with spread operator
function debounce (callback, wait) {
  let timeout
  return (...args) => {
    const context = this
    clearTimeout(timeout)
    timeout = setTimeout(() => callback.apply(context, args), wait)
  }
}

function getContent (node) {
  if (node.nodeName === 'INPUT' || node.nodeName === 'TEXTAREA') {
    return node.value
  } else {
    return node.innerText
  }
}

// catches editable fields being clicked on or edited
// TODO: don't spell check code or other inline editors
async function editable (event) {
  const node = event.target

  // only detect language inside editable fields
  if (!editableFields.includes(node.nodeName) || node.contentEditable === false) {
    return
  }

  const content = getContent(node)

  // if we have already found a reliable language for this element, use it
  // if (node.multiDictDetectedLanguage) {
  //   console.log('Using reliable language ' + node.multiDictDetectedLanguage)
  //   messageHandler.postMessage({
  //     name: 'spell-checker',
  //     language: node.multiDictDetectedLanguage,
  //     content: content
  //   })
  //   return
  // }

  const detectedLanguage = await browser.i18n.detectLanguage(content)
  console.log(detectedLanguage)

  if (detectedLanguage.isReliable) {
    node.multiDictDetectedLanguage = detectedLanguage.languages[0].language
    messageHandler.postMessage({
      name: 'spell-checker',
      language: node.multiDictDetectedLanguage,
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

document.body.addEventListener('click', debounce(editable, 1200))
document.body.addEventListener('keyup', debounce(editable, 1200))

messageHandler.onMessage.addListener((message) => {
  console.log('Got message from background...')
  console.log(message)
})

// inject a listener which triggers from focus event on editable fields
// detect language of content within field
// send a message containing the text to spell check using background.js dictionary
// OR send 'unreliable' and fallback to primary user dictionary
