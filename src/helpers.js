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
    id: 'add',
    type: 'normal',
    title: 'Add word to personal dictionary',
    contexts: ['selection'],
    icons: { 16: 'media/icons/plus-icon.svg' }
  })

  browser.menus.create({
    id: 'remove',
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

// generate a css selector of a given node
function getCssSelector (node) {
  const path = []
  let parent
  while (parent = node.parentNode) { // eslint-disable-line no-cond-assign
    path.unshift(`${node.tagName}:nth-child(${[].indexOf.call(parent.children, node) + 1})`)
    node = parent
  }
  return `${path.join(' > ')}`.toLowerCase()
}

// gets the values of each property of a given style sheet and returns a key value pair object
function getStyleValues (properties, stylesheet) {
  return Object.fromEntries(properties.map(property => {
    return [property, stylesheet.getPropertyValue(property)]
  }))
}

// sets the style properties of a given node
function setStyleValues (node, styles) {
  for (const [style, value] of Object.entries(styles)) {
    node.style[style] = value
  }
}

// return a boolean value that is true if the node is a supported editable node
function isSupported (node) {
  return node.nodeName === 'TEXTAREA'
}

// load local dictionary files from supported languages based on user prefs (acceptLanguages)
function loadDictionariesAndPrefs (languages) {
  // ToDo: check if this negatively impacts memory imprint (may need to fetch dict/aff files)
  const dicts = []
  let prefs = []
  return asyncForEach(languages, async (language) => {
    const dic = await readTextFile(browser.runtime.getURL(`./dictionaries/${language}.dic`))
    const aff = await readTextFile(browser.runtime.getURL(`./dictionaries/${language}.aff`))
    if (!dic.error && !aff.error) {
      prefs.push(language)
      dicts.push({ language, dic, aff })
    }
  }).then(() => {
    // trim first three characters of supported langauges i.e. en-gb > gb
    prefs = prefs.reduce((acc, lang) => acc.concat([lang.slice(3, 5)]), [])
    return { dicts, prefs }
  }).catch((err) => {
    console.error(err)
  })
}

/**
 * offsetBy - return targetNode's position offset by offsetNode
 *
 * @param  {node} childNode - The node whos position we want to calculate
 * @param  {node} parentNode - The node to offset the parentNode's position by
 * @returns {object} - An object containing the top and left offset coordinates measured in pixels
 */
function offsetBy (targetNode, offsetNode) {
  const targetRect = targetNode.getBoundingClientRect()
  const offsetRect = offsetNode.getBoundingClientRect()

  return {
    top: `${targetRect.top - offsetRect.top}px`,
    left: `${targetRect.left - offsetRect.left}px`
  }
}

// prepares a language array from the browser accept languages
function prepareLanguages (languages) {
  return languages.reduce((acc, language, index) => {
    // if we come accross a language code without a locale, use the language as the locale
    if (language.length === 2) {
      language += `-${language}`
      languages[index] = language
    }
    // do not add duplicate languages to language array
    if (languages.indexOf(language) === index) {
      return [...acc, language]
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

// takes a single node, nodeList, or array of nodes and sets attribute to value on all
function setAllAttribute (nodeList, attribute, value = true) {
  if (!Array.isArray(nodeList)) {
    nodeList = Array.from(nodeList)
  }
  nodeList.forEach((node) => node.setAttribute(attribute, value))
}

// return new settings object based on settingsArray
function getSettingsFromArray (settingsArray) {
  const settings = {}
  settingsArray.forEach((setting) => {
    settings[setting.split('-')[0]] = (setting.split('-')[1] === 'true')
  })
  console.log('settings', settings)
  return settings
}

module.exports = {
  blinkMark,
  createMenuItems,
  debounce,
  getAllChildren,
  getCssSelector,
  getStyleValues,
  hasChildNodes,
  isSupported,
  loadDictionariesAndPrefs,
  prepareLanguages,
  offsetBy,
  setAllAttribute,
  setStyleValues,
  getSettingsFromArray
}
