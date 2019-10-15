const messageHandler = browser.runtime.connect({ name: 'popup' })

const personalDictionary = document.querySelector('#dictionary')
const wordsList = document.querySelector('.words')
const arrowDiv = document.querySelector('.arrow')

const wordItem = document.createElement('li')
const hrefChild = document.createElement('a')
wordItem.classList.add('ownWord')
hrefChild.setAttribute('href', '#')
wordItem.appendChild(hrefChild)

let showingWords = false

function removeWord (node) {
  messageHandler.postMessage({ type: 'remove', word: node.textContent })
  wordsList.removeChild(node)
}

function hideWords () {
  while (wordsList.firstChild) {
    wordsList.removeChild(wordsList.firstChild)
  }
  showingWords = false
}

function showWords (customWords) {
  customWords.forEach((word) => {
    wordItem.textContent = word
    wordsList.appendChild(wordItem.cloneNode(true))
  })
  showingWords = true
}

function handleWords (e) {
  if (showingWords && e.target.parentNode === personalDictionary) {
    arrowDiv.textContent = '▶'
    hideWords()
  } else if (!showingWords) {
    arrowDiv.textContent = '▼'
    messageHandler.postMessage({ type: 'getWords' })
  } else if (e.target.classList.contains('ownWord')) {
    removeWord(e.target)
  }
}

// listen to incoming messages from background script
messageHandler.onMessage.addListener((message) => {
  if (message.type === 'getWords') {
    showWords(message.customWords)
  }
})

personalDictionary.addEventListener('click', handleWords)
