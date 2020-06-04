const messageHandler = browser.runtime.connect({ name: 'popup' })

const dictionary = document.querySelector('#dictionary')
const settings = document.querySelector('#settings')
const listItem = document.createElement('li')
const hrefChild = document.createElement('a')
const input = document.createElement('input')
const label = document.createElement('label')

const optionLabels = {
  disableNativeSpellcheck: 'Disable duplicate spellchecking (requires page refresh)'
}

let showingWords = false
let showingOptions = false

listItem.appendChild(hrefChild)
hrefChild.setAttribute('href', '#')
input.type = 'checkbox'

function hideListItems (list, words) {
  while (list.firstChild) {
    list.removeChild(list.firstChild)
  }

  if (words) {
    showingWords = false
  } else {
    showingOptions = false
  }
}

function populateList (list, customWords) {
  customWords.forEach((word) => {
    listItem.textContent = word
    list.appendChild(listItem.cloneNode(true))
  })
  listItem.textContent = ''
  showingWords = true
}

function populateOptions (list, options) {
  // options are an array of strings stored like so: ['key-value, key-value, key-value']
  for (const [key, value] of Object.entries(options)) {
    input.id = key
    input.name = key
    input.value = value
    input.checked = value
    label.textContent = optionLabels[key]
    label.setAttribute('for', key)
    label.appendChild(input)
    listItem.appendChild(label)
    list.appendChild(listItem.cloneNode(true))
  }
  showingOptions = true
}

function getSettingsFromPopup () {
  const settingsArray = []
  document.querySelectorAll('.options input').forEach((setting) => {
    settingsArray.push(`${setting.id}-${setting.value}`)
  })
  return settingsArray
}

// word related click event listener (fetching, hiding, and removing custom words)
function handleWords (e) {
  const wordsList = document.querySelector('.words')
  const dictionaryArrow = document.querySelector('#dictionary .arrow')
  if (showingWords && e.target.parentNode === dictionary) {
    dictionaryArrow.textContent = '▶'
    hideListItems(wordsList, 'words')
  } else if (!showingWords) {
    dictionaryArrow.textContent = '▼'
    messageHandler.postMessage({ type: 'getCustomWords' })
  } else if (e.target.matches('.words li')) {
    messageHandler.postMessage({ type: 'remove', word: e.target.textContent })
    wordsList.removeChild(e.target)
  }
}

// checkbox related input event listener (displaying and updating persistent options)
function handleOptions (e) {
  const optionsList = document.querySelector('.options')
  const optionsArrow = document.querySelector('#settings .arrow')
  if (showingOptions && e.target.parentNode === settings) {
    optionsArrow.textContent = '▶'
    hideListItems(optionsList)
  } else if (!showingOptions) {
    optionsArrow.textContent = '▼'
    messageHandler.postMessage({ type: 'getCustomSettings' })
  } else if (e.target.matches('.options input')) {
    e.target.value = e.originalTarget.checked
    messageHandler.postMessage({ type: 'saveSettings', settings: getSettingsFromPopup() })
  }
}

// listen to incoming messages from background script
messageHandler.onMessage.addListener((message) => {
  if (message.type === 'getCustomWords') {
    populateList(document.querySelector('.words'), message.customWords)
  }

  if (message.type === 'getCustomSettings') {
    populateOptions(document.querySelector('.options'), message.customSettings)
  }
})

dictionary.addEventListener('click', handleWords)
settings.addEventListener('click', handleOptions)
