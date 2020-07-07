// remove the first instance of an item inside an array  (extends native array object)
if (!Array.prototype.remove) {
  Array.prototype.remove = function remove (item) { // eslint-disable-line no-extend-native
    if (!(this || Array.isArray(this))) {
      throw new TypeError()
    }

    if (this.includes(item) || this.indexOf(item) !== -1) {
      this.splice(this.indexOf(item), 1)
      return this
    }

    // handles cases where item is a finite index and element at given index is defined
    if (typeof this[item] !== 'undefined' && item >= 0 && Number.isFinite(item)) {
      this.splice(item, 1)
      return this
    }
  }
}

// custom async forEach function taken from p-iteration
async function asyncForEach (array, callback, thisArg) {
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

// make target mark element blink N times over M milliseconds by alternating backgroundColor
function blinkMark (mark, times, milliseconds) {
  const tempInterval = setInterval(() => {
    mark.classList.contains('color')
      ? mark.classList.remove('color')
      : mark.classList.add('color')
  }, Math.round(milliseconds / times))

  setTimeout(() => {
    clearInterval(tempInterval)
    mark.classList.add('color')
  }, milliseconds)
}

// create Add and Remove multdict context menu items
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

// sexy es6 debounce with spread operator
function debounce (callback, wait) {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(function () { callback.apply(this, args) }, wait)
  }
}

// check if a node has childNodes
function hasChildNodes (node) {
  return (typeof node === 'object') &&
    (typeof node.childNodes !== 'undefined') &&
    (node.childNodes.length > 0)
}

// takes a node or nodeList and recursively puts the node and all childNodes into a flat array
function getAllChildren (nodeList, acc = []) {
  if (!Array.isArray(nodeList)) {
    nodeList = Array.from(nodeList)
  }

  nodeList.forEach((node) => {
    acc.push(node)
    if (hasChildNodes(node)) {
      getAllChildren(node.childNodes, acc)
    }
  })
  return acc
}

// returns an array of languages based on getAcceptLanguages and getUILanguage to use as defaults
async function getDefaultLanguages () {
  const acceptedLanguages = await browser.i18n.getAcceptLanguages()
  const uiLanguage = await browser.i18n.getUILanguage()

  return [...acceptedLanguages, uiLanguage]
}

// return a boolean value that is true if the node is a supported editable node
function isSupported (node) {
  return node.nodeName === 'TEXTAREA'
}

// load local dictionary files from supported languages based on user prefs
function loadDictionaries (languages) {
  // ToDo: check if this negatively impacts memory imprint (may need to fetch dict/aff files)
  const dicts = []
  return asyncForEach(languages, async (language) => {
    const dic = await readTextFile(browser.runtime.getURL(`./dictionaries/${language}.dic`))
    const aff = await readTextFile(browser.runtime.getURL(`./dictionaries/${language}.aff`))
    if (!dic.error && !aff.error) {
      dicts.push({ language, dic, aff })
    }
  }).then(() => dicts)
}

// prepares a language array from the browser accepted and UI languages: ['de-de', 'en-au', 'en-gb']
function prepareLanguages (languages) {
  return languages.reduce((acc, language, index) => {
    // if we come across a language code without a locale, use the language code as the locale
    if (language.length === 2) {
      language += `-${language}`
      languages[index] = language
    }
    // this prevents adding duplicate languages to language array
    if (languages.indexOf(language) === index) {
      return [...acc, language.toLowerCase()]
    }
    return acc
  }, [])
}

// read a text file, the firefox extension way
function readTextFile (path) {
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
 * setNodeListAttributess - takes a node, array of nodes, or nodeList and object of attribute values
 * to set on the given nodes (operates on them in place)
 *
 * @param  {(node|node[]|nodeList)} nodeList - the list or array of nodes to operate on
 * @param  {object} attributes - object of attribute key value pairs
 * @returns {undefined}
 */

function setNodeListAttributes (nodeList, attributes) {
  if (!Array.isArray(nodeList)) nodeList = Array.from(nodeList)

  nodeList.forEach(node =>
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value)))
}

module.exports = {
  blinkMark,
  createMenuItems,
  debounce,
  getAllChildren,
  getDefaultLanguages,
  hasChildNodes,
  isSupported,
  loadDictionaries,
  prepareLanguages,
  setNodeListAttributes
}
