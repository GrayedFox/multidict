const messageHandler = browser.runtime.connect({ name: 'popup' })

const optionLabels = {
  disableNativeSpellcheck: 'Disable duplicate spellchecking (requires page refresh)'
}

const dictionary = document.querySelector('#dictionary')
const wordsList = document.querySelector('.words')
const settings = document.querySelector('#settings')
const optionsList = document.querySelector('.options')
const colorPicker = document.querySelector('#colorPicker input')
const suggestionSlider = document.querySelector('#suggestions input')
const suggestionOutput = document.querySelector('#suggestions output')

const listLinkItem = '<li><a href="#"></a></li>'
let highlightColor = null

// handles all messages received from background script
function api (message) {
  switch (message.type) {
    case 'addWord':
    case 'removeWord':
      populateUserDictionaryList(message.content)
      break
    case 'gotCustomWords':
      populateUserDictionaryList(message.content)
      hideListItems(wordsList)
      break
    case 'gotCustomSettings':
      populateCustomSettingsList(message.content)
      hideListItems(optionsList)
      break
    case 'gotCustomColor':
      setColorValue(message.content.color)
      break
    case 'gotMaxSuggestions':
      setMaxSuggestionsLimit(message.content.maxSuggestions)
      break
    default:
      console.warn('MultiDict: popup did not recognize message type', message.type)
  }
}

const setMaxSuggestionsLimit = limit => {
  suggestionSlider.value = limit
  suggestionOutput.textContent = limit
}

const setColorValue = color => {
  highlightColor = color
  colorPicker.setAttribute('value', color)
}

function populateCustomSettingsList (options) {
  const label = document.createElement('label')
  const input = document.createElement('input')
  const fragment = new DocumentFragment()

  input.type = 'checkbox'

  let child

  // options are an array of strings formatted like so: ['key-value, key-value, key-value']
  for (const [key, value] of Object.entries(options)) {
    input.id = key
    input.name = key
    input.value = value
    input.checked = value
    label.textContent = optionLabels[key]
    label.setAttribute('for', key)
    label.appendChild(input)
    fragment.appendChild(htmlToNodes(listLinkItem)[0])
    child = fragment.lastChild
    child.appendChild(label)
  }
  optionsList.appendChild(fragment)
}

function populateUserDictionaryList (customWords) {
  while (wordsList.firstChild) { wordsList.removeChild(wordsList.firstChild) }
  const fragment = new DocumentFragment()
  let child
  customWords.forEach(word => {
    fragment.append(htmlToNodes(listLinkItem)[0])
    child = fragment.lastChild
    child.textContent = word
  })
  wordsList.appendChild(fragment)
}

// handles updating the background color of the slider to match the highlight color
function handleSliderColor (event) {
  if (event.type === 'mouseenter') {
    event.target.style.backgroundColor = highlightColor
  }
  if (event.type === 'mouseleave') {
    event.target.style.backgroundColor = null
  }
}

// handle the suggestions slider change event
function handleSliderChange (event) {
  setMaxSuggestionsLimit(event.target.value)
  messageHandler.postMessage({ type: 'saveMaxSuggestions', limit: event.target.value })
}

// handle the colorPicker submission/dismissal event
function handleColorChange (event) {
  const newColor = event.target.value
  highlightColor = newColor
  messageHandler.postMessage({ type: 'saveColor', color: newColor })
}

// handle previewing colours inside current textarea
function handleColorPreview (event) {
  messageHandler.postMessage({ type: 'previewColor', color: event.target.value })
}

// word related click event listener (fetching, hiding, and removing custom words)
function handleWords (event) {
  const visible = wordsList.hasAttribute('visible')
  if (visible && event.target.parentNode === dictionary) {
    hideListItems(wordsList)
  } else if (!visible) {
    showListItems(wordsList)
  } else if (event.target.matches('.words li')) {
    messageHandler.postMessage({ type: 'remove', word: event.target.textContent })
    wordsList.removeChild(event.target)
  }
}

// checkbox related input event listener (displaying and updating persistent options)
function handleOptions (event) {
  const visible = optionsList.hasAttribute('visible')
  if (visible && event.target.parentNode === settings) {
    hideListItems(optionsList)
  } else if (!visible) {
    showListItems(optionsList)
  } else if (event.target.matches('.options input')) {
    event.target.value = event.originalTarget.checked
    messageHandler.postMessage({ type: 'saveSettings', settings: getSettingsFromPopup() })
  }
}

// generate settings array from checked options
function getSettingsFromPopup () {
  const settingsArray = []
  optionsList.querySelectorAll('input').forEach((setting) => {
    settingsArray.push(`${setting.id}-${setting.value}`)
  })
  return settingsArray
}

// show everything in a given list
function showListItems (list) {
  let child = list.firstElementChild
  while (child) {
    child.style.display = null
    child = child.nextSibling
  }
  list.setAttribute('visible', true)
  list.parentNode.querySelector('.arrow').textContent = '▼'
}

// hide everything in a given list and change arrow direction
function hideListItems (list) {
  let child = list.firstElementChild
  while (child) {
    child.style.display = 'none'
    child = child.nextSibling
  }
  list.removeAttribute('visible')
  list.parentNode.querySelector('.arrow').textContent = '▶'
}

// create nodes from valid HTML strings
function htmlToNodes (htmlString) {
  const temp = document.createElement('template')
  htmlString = htmlString.trim()
  temp.innerHTML = htmlString
  return temp.content.childNodes
}

function main () {
  // listen to incoming messages from background script
  messageHandler.onMessage.addListener(api)
  messageHandler.postMessage({ type: 'getCustomWords' })
  messageHandler.postMessage({ type: 'getSettings' })
  messageHandler.postMessage({ type: 'getColor' })
  messageHandler.postMessage({ type: 'getMaxSuggestions' })
  messageHandler.postMessage({ type: 'sidebar', isOpen: true })

  dictionary.addEventListener('click', handleWords)
  settings.addEventListener('click', handleOptions)
  colorPicker.addEventListener('change', handleColorChange)
  colorPicker.addEventListener('input', handleColorPreview)
  suggestionSlider.addEventListener('input', handleSliderChange)
  suggestionSlider.addEventListener('mouseenter', handleSliderColor)
  suggestionSlider.addEventListener('mouseleave', handleSliderColor)

  window.addEventListener('unload',
    () => { messageHandler.postMessage({ type: 'sidebar', isOpen: false }) })
}

main()
