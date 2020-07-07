const messageHandler = browser.runtime.connect({ name: 'popup' })

const optionLabels = {
  disableNativeSpellcheck: 'Disable native spell checking'
}

const languageLabels = {
  'en-en': 'American English',
  'en-au': 'Australian English',
  'en-gb': 'British English',
  'fr-fr': 'French',
  'de-de': 'German',
  'pl-pl': 'Polish',
  'ro-ro': 'Romanian',
  'ru-ru': 'Russian',
  'es-es': 'Spanish'
}

const dictionary = document.querySelector('#dictionary')
const wordsList = document.querySelector('.words')
const settings = document.querySelector('#settings')
const settingsOptionsList = document.querySelector('#settings .options')
const languages = document.querySelector('#languages')
const languagesOptionsList = document.querySelector('#languages .options')
const colorPicker = document.querySelector('#colorPicker input')
const suggestionSlider = document.querySelector('#suggestions input')
const suggestionOutput = document.querySelector('#suggestions output')

let highlightColor = null
let dragSourceNode = null

function init () {
  // listen to incoming messages from background script
  messageHandler.onMessage.addListener(api)
  messageHandler.postMessage({ type: 'getLanguages' })
  messageHandler.postMessage({ type: 'getCustomWords' })
  messageHandler.postMessage({ type: 'getSettings' })
  messageHandler.postMessage({ type: 'getColor' })
  messageHandler.postMessage({ type: 'getMaxSuggestions' })
  messageHandler.postMessage({ type: 'sidebar', isOpen: true })

  dictionary.addEventListener('click', handleWords)
  settings.addEventListener('click', handleOptions)
  languages.addEventListener('click', handleOptions)
  colorPicker.addEventListener('change', handleColorChange)
  colorPicker.addEventListener('input', handleColorPreview)
  suggestionSlider.addEventListener('input', handleSliderChange)
  suggestionSlider.addEventListener('mouseenter', handleSliderColor)
  suggestionSlider.addEventListener('mouseleave', handleSliderColor)

  generateListOptions(languagesOptionsList, languageLabels)
  generateListOptions(settingsOptionsList, optionLabels)

  window.addEventListener('unload',
    () => { messageHandler.postMessage({ type: 'sidebar', isOpen: false }) })
}

// handles all messages received from background script
function api (message) {
  switch (message.type) {
    case 'addedWord':
    case 'removedWord':
      populateUserDictionaryList(message.content)
      showListItems(wordsList)
      break
    case 'gotCustomWords':
      populateUserDictionaryList(message.content)
      hideListItems(wordsList)
      break
    case 'gotLanguages':
      populateListOptions(languagesOptionsList, message.content)
      break
    case 'gotCustomSettings':
      populateListOptions(settingsOptionsList, message.content)
      break
    case 'gotCustomColor':
      setColorValue(message.content.color)
      break
    case 'gotMaxSuggestions':
      setMaxSuggestionsLimit(message.content.maxSuggestions)
      break
    default:
      console.warn('Multidict: popup did not recognize message type', message.type)
  }
}

// generate checkboxes inside a given list based on labels and set value and checked to false
function generateListOptions (list, labels) {
  const label = document.createElement('label')
  const input = document.createElement('input')
  const fragment = new DocumentFragment()
  const listLinkItem = '<li class="draggable" draggable="true"><a href="#"></a></li>'

  input.type = 'checkbox'

  let child

  for (const [key, value] of Object.entries(labels)) {
    input.id = key
    input.name = key
    input.value = false
    input.checked = false
    label.textContent = value
    label.setAttribute('for', key)
    label.appendChild(input)
    fragment.appendChild(htmlToNodes(listLinkItem)[0])
    child = fragment.lastChild
    if (list === languagesOptionsList) addDragAndDropEvents(child)
    child.appendChild(label.cloneNode(true))
  }
  list.appendChild(fragment)

  hideListItems(list)
}

const setMaxSuggestionsLimit = limit => {
  suggestionSlider.value = limit
  if (limit === 10 || limit === '10') {
    limit += '+'
  }
  suggestionOutput.textContent = limit
}

const setColorValue = color => {
  highlightColor = color
  colorPicker.setAttribute('value', highlightColor)
}

// populate the check box values of a given list using an array of options
function populateListOptions (list, options) {
  // options are an array of ordered strings like so: ['de-de', 'en-gb'] or ['disableNativeSpellcheck']
  let i = 0
  for (const option of options) {
    const node = document.querySelector(`#${option}`)
    if (node) {
      node.value = true
      node.checked = true
    }
    if (node && list === languagesOptionsList) {
      list.insertBefore(node.parentNode.parentNode, list.childNodes[i])
      i++
    }
  }
}

// populate personal dictionary list with custom words
function populateUserDictionaryList (customWords) {
  const listLinkItem = '<li><a href="#"></a></li>'
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
  setColorValue(newColor)
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
    messageHandler.postMessage({ type: 'removeCustomWord', word: event.target.textContent })
    wordsList.removeChild(event.target)
  }
}

// checkbox related input event listener (displaying and updating persistent options)
function handleOptions (event) {
  const parent = event.target.parentNode
  const list = parent.querySelector('.options')
  const visible = list && list.hasAttribute('visible')
  if (list && visible && (parent === languages || parent === settings)) {
    hideListItems(list)
  } else if (list && !visible) {
    showListItems(list)
  } else if (event.target.matches('#languages .options input')) {
    notify('Language Changed', `Please restart your browser to add/remove ${parent.textContent} spelling highlights`)
    event.target.value = event.originalTarget.checked
    messageHandler.postMessage({ type: 'saveLanguages', languages: getSettingsFromList(languagesOptionsList) })
  } else if (event.target.matches('#settings .options input')) {
    event.target.value = event.originalTarget.checked
    messageHandler.postMessage({ type: 'saveSettings', settings: getSettingsFromList(settingsOptionsList) })
  }
}

function dragStart (e) {
  if (!isDraggable(e.target)) return
  e.target.style.opacity = '0.4'
  dragSourceNode = e.target
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/html', e.target.innerHTML)
};

function dragEnter (e) {
  if (!isDraggable(e.target)) return
  e.target.classList.add('over')
}

function dragLeave (e) {
  if (!isDraggable(e.target)) return
  e.stopPropagation()
  e.target.style.border = ''
  e.target.classList.remove('over')
}

function dragOver (e) {
  if (!isDraggable(e.target)) return
  const bounding = e.target.getBoundingClientRect()
  const offset = bounding.y + (bounding.height / 2)
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  if (e.clientY - offset > 0) {
    e.target.style['border-bottom'] = `solid 0.3em ${highlightColor}`
    e.target.style['border-top'] = ''
  } else {
    e.target.style['border-top'] = `solid 0.3em ${highlightColor}`
    e.target.style['border-bottom'] = ''
  }
  // return false
}

function dragDrop (e) {
  if (!isDraggable(e.target)) return
  if (dragSourceNode !== e.target) {
    if (e.target.style['border-bottom'] !== '') {
      e.target.style['border-bottom'] = ''
      e.target.parentNode.insertBefore(dragSourceNode, e.target.nextSibling)
    } else {
      e.target.style['border-top'] = ''
      e.target.parentNode.insertBefore(dragSourceNode, e.target)
    }
    notify('Language Moved', `${dragSourceNode.textContent} priority updated`)
    messageHandler.postMessage({ type: 'saveLanguages', languages: getSettingsFromList(languagesOptionsList) })
  }
}

function dragEnd (e) {
  if (!isDraggable(e.target)) return
  e.target.classList.remove('over')
  e.target.style.opacity = ''
  e.target.style.border = ''
}

function isDraggable (node) {
  return node && node.classList && node.classList.contains('draggable')
}

function addDragAndDropEvents (node) {
  node.addEventListener('dragstart', dragStart, false)
  node.addEventListener('dragenter', dragEnter, false)
  node.addEventListener('dragover', dragOver, false)
  node.addEventListener('dragleave', dragLeave, false)
  node.addEventListener('drop', dragDrop, false)
  node.addEventListener('dragend', dragEnd, false)
}

// create a notification to display to the user
function notify (title, message) {
  browser.notifications.create('language-change-notification', {
    type: 'basic',
    iconUrl: browser.runtime.getURL('media/icons/icon-64.png'),
    title,
    message
  })
}

// generate settings array from checked options
function getSettingsFromList (list) {
  const settingsArray = []
  list.querySelectorAll('input').forEach((setting) => {
    if (setting.value === 'true') {
      settingsArray.push(setting.id)
    }
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

init()
