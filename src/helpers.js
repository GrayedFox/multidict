// search an array for a specific item and remove it (extends native array object)
if (!Array.prototype.remove) {
  Array.prototype.remove = function remove (item) { // eslint-disable-line no-extend-native
    if (!(this || Array.isArray(this))) {
      throw new TypeError()
    }

    if (this.includes(item)) {
      return this.splice(this.indexOf(item), 1)
    }
  }
}

// custom async forEach function taken from p-iteration
async function _forEach (array, callback, thisArg) {
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

// read a text file, the firefox extension way
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

// clean content and strip out unwanted text/patterns before spell checking
function _cleanContent (content) {
  const rxUrls = /^(http|ftp|www)/
  const rxSeparators = /[\s.,:;!?_<>{}()[\]"`´^$°§½¼³%&¬+=*~#|/\\]/
  const rxSingleQuotes = /^'+|'+$/

  // split all content by any character that should not form part of a word
  return content.split(rxSeparators)
    .reduce((acc, string) => {
      // remove any number of single quotes that do not form part of a word i.e. 'y'all' > y'all
      string = string.replace(rxSingleQuotes, '')
      // filter out emails, URLs, numbers, and text less than 2 characters in length
      if (!string.includes('@') && !rxUrls.test(string) && isNaN(string) && string.length > 1) {
        return acc.concat([string])
      }
      return acc
    }, [])
}

// check spelling of content and return misspelt words and suggestions
function checkSpelling (spell, content) {
  const spelling = {
    cleanedContent: _cleanContent(content),
    misspeltWords: [],
    suggestions: {}
  }

  for (const word of spelling.cleanedContent) {
    if (!spell.correct(word)) {
      spelling.suggestions[word] = spell.suggest(word)
      spelling.misspeltWords.push(word)
    }
  }

  console.log('cleaned content', spelling.cleanedContent)
  console.log('misspelt words', spelling.misspeltWords)
  console.log('suggestions', spelling.suggestions)

  return spelling
}

function createMenuItems () {
  browser.contextMenus.create({
    id: 'add',
    type: 'normal',
    title: 'Add word to personal dictionary',
    contexts: ['selection'],
    icons: { 16: '/icons/plus-icon.svg' }
  })

  browser.contextMenus.create({
    id: 'remove',
    type: 'normal',
    title: 'Remove word from personal dictionary',
    contexts: ['selection'],
    icons: { 16: '/icons/minus-icon.svg' }
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

// load local dictionary files from supported languages based on user prefs (acceptLanguages)
function loadDictionariesAndPrefs (languages) {
  const dicts = []
  let prefs = []
  return _forEach(languages, async (language) => {
    prefs.push(language)
    const dic = await _readTextFile(browser.runtime.getURL(`./dictionaries/${language}.dic`))
    const aff = await _readTextFile(browser.runtime.getURL(`./dictionaries/${language}.aff`))
    if (!dic.error && !aff.error) {
      dicts.push({ language, dic, aff })
    } else {
      // remove unfound/unsupported languages from preferred languages
      prefs = prefs.filter((value) => value !== language)
    }
  }).then(function () {
    // trim first three characters of supported langauges i.e. de-de > de
    prefs = prefs.reduce((acc, lang) => acc.concat([lang.slice(3, 5)]), [])
    return { dicts, prefs }
  }).catch(function (err) {
    console.error(err)
  })
}

module.exports = {
  checkSpelling,
  createMenuItems,
  debounce,
  loadDictionariesAndPrefs
}
