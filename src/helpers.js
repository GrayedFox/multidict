/**
 * Helper methods.
 * @namespace Helpers
 */

/**
 * Custom async forEach function taken from p-iteration
 *
 * @private
 * @memberof Helpers
 * @see {@link https://toniov.github.io/p-iteration/global.html#forEach|p-iteration}
 * @param  {Promise[]} array - array of promises, executed concurrently
 * @param  {Function} callback - the callback function called using the resolved value of each promise
 * @param  {Object} [thisArg] - optional this context
 * @returns {Promise} A promise that resolves only after all other promises are done
 */
/* istanbul ignore next */
async function _asyncForEach (array, callback, thisArg) {
  const promiseArray = []

  for (let i = 0; i < array.length; i++) {
    if (i in array) {
      const p = Promise.resolve(array[i]).then((currentValue) => {
        return callback.call(thisArg || this, currentValue, i, array)
      })
      promiseArray.push(p)
    }
  }
  await Promise.all(promiseArray)
}

/**
 * Blink target node N times over half a second by adding and removing color class
 *
 * @memberof Helpers
 * @param  {Node} node - the node we will add and remove the color class from
 * @param  {number} times - the amount of times to blink the node. Must be an integer.
 */
function blinkNode (node, times) {
  const interval = 500 / (times * 2)

  // removing the color class first ensures we change color the correct amount of times
  node.classList.remove('color')

  const tempInterval = setInterval(() => {
    node.classList.contains('color')
      ? node.classList.remove('color')
      : node.classList.add('color')
  }, interval)

  setTimeout(() => {
    clearInterval(tempInterval)
  }, 500)
}

/**
 * Adds Multidict add/remove context menu items for when user selects text
 *
 * @memberof Helpers
 */
function createMenuItems () {
  browser.menus.create({
    id: 'addCustomWord',
    type: 'normal',
    title: 'Add word to personal dictionary',
    contexts: ['selection'],
    icons: { 16: 'media/icons/plus-icon.svg' }
  })

  browser.menus.create({
    id: 'removeCustomWord',
    type: 'normal',
    title: 'Remove word from personal dictionary',
    contexts: ['selection'],
    icons: { 16: 'media/icons/minus-icon.svg' }
  })
}

/**
 * A debounced function is a function that will delay the execution of the inner (callback) function
 * by a certain amount of time each time the debounced (returned) function is called. In our case,
 * we don't want to spellcheck text every time the user presses a key, so we debounce the spellcheck
 * function with each keypress. This way each keypress will delay the spellcheck logic by {wait},
 * which means we will only spellcheck text after the user has stopped typing.
 *
 * @memberof Helpers
 * @constructor
 * @param  {Function} callback - the callback function to be executed after wait expires
 * @param  {number} wait - the amount of time, in milliseconds, to debounce the function
 * @returns {Function} - the function to be executed after wait
 */
function debounce (callback, wait) {
  if (typeof callback !== 'function') throw new TypeError('First argument to debounce must be of type function')
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(function () { callback.apply(this, args) }, wait)
  }
}

/**
 * Checks if a node has any children.
 *
 * @private
 * @memberof Helpers
 * @param  {Node} node - the node to check
 * @returns {Boolean} True if the node has any children
 */
function _hasChildNodes (node) {
  return (typeof node === 'object') &&
    (typeof node.childNodes !== 'undefined') &&
    (node.childNodes.length > 0)
}

/**
 * Takes a node or nodeList and recursively flattens the node(s) and all children into an array
 *
 * @memberof Helpers
 * @param  {Node|Node[]|NodeList} nodeList - the nodeList, node, or array of nodes to operate on
 * @param  {Array} [accumulator=[]] - array used to accumulate all child nodes (defaults to empty)
 * @returns {Array} Flattened array of node(s) and all child nodes
 */
function flattenAllChildren (nodeList, accumulator = []) {
  if (typeof nodeList.nodeType === 'number') nodeList = [nodeList]
  if (!Array.isArray(nodeList)) nodeList = Array.from(nodeList)

  nodeList.forEach((node) => {
    accumulator.push(node)
    if (_hasChildNodes(node)) {
      flattenAllChildren(node.childNodes, accumulator)
    }
  })
  return accumulator
}

/**
 * Returns an array of languages based on getAcceptLanguages and getUILanguage to use as defaults
 * for when no saved languages exist in browser storage.
 *
 * @memberof Helpers
 * @returns {array} Array of language codes i.e. ['en-US', 'fr']
 */
async function getDefaultLanguages () {
  const acceptedLanguages = await browser.i18n.getAcceptLanguages()
  const uiLanguage = browser.i18n.getUILanguage()

  return [uiLanguage].concat(acceptedLanguages)
}

/**
 * Return a boolean value that is true if the node is a supported editable node
 *
 * @memberof Helpers
 * @param  {node} node - the node to be checked
 * @returns {boolean} True if the node is a text area
 */
function isSupported (node) {
  return node.nodeName === 'TEXTAREA'
}

/**
 * Loads local dictionary files from supported languages
 *
 * @memberof Helpers
 * @param  {array} languages - array of all lowercase 5 digit language codes: ['de-de', 'en-au']
 * @returns {Promise} Promise resolves array of dictionary objects: [{ 'de-de', dic, aff }, { 'en-au', dic, aff }]
 */
/* istanbul ignore next */
function loadDictionaries (languages) {
  // ToDo: check if this negatively impacts memory imprint (may need to fetch dict/aff files)
  const dicts = []
  return _asyncForEach(languages, async (language) => {
    const dic = await _readTextFile(browser.runtime.getURL(`./dictionaries/${language}.dic`))
    const aff = await _readTextFile(browser.runtime.getURL(`./dictionaries/${language}.aff`))
    if (!dic.error && !aff.error) {
      dicts.push({ language, dic, aff })
    }
  }).then(() => dicts)
}

/**
 * Creates a notification that is displayed to the user
 *
 * @memberof Helpers
 * @param  {type} title - the notification title
 * @param  {type} message - the message that will appear as the notification body
 */
function notify (title, message) {
  browser.notifications.create(title, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('media/icons/icon-64.png'),
    title,
    message
  })
}

/**
 * Prepares a language array from an array of language codes
 *
 * @memberof Helpers
 * @param  {string[]} languageCodes - array of langauge codes i.e. ['de-DE', 'en-AU', 'en', 'fr']
 * @returns {string[]} Array of normalised language codes i.e. ['de-de', 'en-au', 'en-en', 'fr-fr']
 */
function prepareLanguages (languageCodes) {
  return languageCodes.reduce((acc, language, index) => {
    // if we come across a language code without a locale, use the language code as the locale
    if (language.length === 2) {
      language += `-${language}`
      languageCodes[index] = language
    }
    // this prevents adding duplicate languageCodes to language array
    if (languageCodes.indexOf(language) === index) {
      return [...acc, language.toLowerCase()]
    }
    return acc
  }, [])
}

/**
 * Reads a text file, the Firefox web-extension way. Returns a promise
 *
 * @private
 * @memberof Helpers
 * @param  {string} path - the path from which to read the text file
 * @returns {Promise} Promise resolves with the entire text read from the text file
 */
/* istanbul ignore next */
function _readTextFile (path) {
  return new Promise((resolve, reject) => {
    fetch(path, { mode: 'same-origin' })
      .then(function (res) {
        return res.blob()
      })
      .then(function (blob) {
        const reader = new FileReader()

        reader.addEventListener('loadend', function () {
          resolve(this.result)
        })

        reader.readAsText(blob)
      })
      .catch(error => {
        resolve({ error: error })
      })
  })
}

/**
 * Takes a node, array of nodes, or nodeList and object of attribute key value pairs to set on the
 * given nodes
 *
 * @memberof Helpers
 * @param  {(node|node[]|nodeList)} nodeList - the nodeList, node, or array of nodes to operate on
 * @param  {object} attributes - object of attribute key value pairs
 */
function setNodeListAttributes (nodeList, attributes) {
  if (typeof nodeList.nodeType === 'number') nodeList = [nodeList]
  if (!Array.isArray(nodeList)) nodeList = Array.from(nodeList)

  nodeList.forEach(node =>
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value)))
}

module.exports = {
  blinkNode,
  createMenuItems,
  debounce,
  flattenAllChildren,
  getDefaultLanguages,
  isSupported,
  loadDictionaries,
  notify,
  prepareLanguages,
  setNodeListAttributes
}
