// custom async forEach function taken from p-iteration
async function forEach (array, callback, thisArg) {
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

// sexy es6 debounce with spread operator
function debounce (callback, wait) {
  let timeout
  return (...args) => {
    const context = this
    clearTimeout(timeout)
    timeout = setTimeout(() => callback.apply(context, args), wait)
  }
}

// get text from a given node
function getText (node) {
  return node.value.length > 0 ? node.value : node.innerText
}

// read a text file, the firefox extension way
function readFile (path) {
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
function cleanContent (content) {
  const rxUrls = /^(http|ftp|www)/
  const rxSeparators = /[\s.,:;!?_<>{}()[\]"`´^$°§½¼³%&¬+=*~#|/\\]/
  const rxSingleQuotes = /^'+|'+$/gm

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
    cleanedContent: cleanContent(content),
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

// get local dictionary files according to supported languages
async function loadDictionariesAndPrefs (languages) {
  const dicts = []
  let prefs = []
  return forEach(languages, async (lang) => {
    prefs.push(lang)
    const dic = await readFile(browser.runtime.getURL(`./dictionaries/${lang}.dic`))
    const aff = await readFile(browser.runtime.getURL(`./dictionaries/${lang}.aff`))
    if (!dic.error && !aff.error) {
      dicts.push({ languageCode: lang, dic: dic, aff: aff })
    } else {
      // prevent race condition when reading files changes the preferred language order
      prefs = prefs.filter((value) => value !== lang)
    }
  }).then(function () {
    return { dicts, prefs }
  }).catch(function (err) {
    console.log(err)
  })
}

module.exports = {
  checkSpelling,
  debounce,
  getText,
  loadDictionariesAndPrefs
}
