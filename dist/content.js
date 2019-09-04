(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const messageHandler = browser.runtime.connect({ name: 'spell-checker' })
const editableFields = ['INPUT', 'TEXTAREA', 'DIV']
const { debounce, getText, underline } = require('./helpers.js')

// catches editable fields being clicked on or edited
// TODO: don't spell check code or other inline editors
async function editable (event) {
  const node = event.target

  // only detect language and spellcheck editable fields
  if (!editableFields.includes(node.nodeName) || node.contentEditable === false) {
    return
  }

  const content = getText(node)
  const detectedLanguage = await browser.i18n.detectLanguage(content)

  console.log(node.nodeName)
  console.log(detectedLanguage)

  // for some reason, cannot send node (event.target) in message. Size restriction?
  if (detectedLanguage.isReliable) {
    messageHandler.postMessage({
      name: 'spell-checker',
      language: detectedLanguage.languages[0].language,
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

// background script message object should contain: { spelling, node }
messageHandler.onMessage.addListener((message) => {
  console.log('Got message from background...')
  console.log(message)
  if (message.spelling) {
    underline(message.spelling.misspeltWords, message.hello)
  }
})

messageHandler.onDisconnect.addListener((p) => {
  if (p.error) {
    console.log(`Disconnected due to an error: ${p.error.message}`)
  }
})

// BUG: click event listener sends single line of text instead of content of entire editable field
// TODO: tie click event to suggesting words instead of spell checking
document.body.addEventListener('click', debounce(editable, 1200))
document.body.addEventListener('keyup', debounce(editable, 1200))

// inject a listener which triggers from focus event on editable fields
// detect language of content within field
// send a message containing the text to spell check using background.js dictionary
// OR send 'unreliable' and fallback to primary user dictionary

},{"./helpers.js":2}],2:[function(require,module,exports){
// custom promisifed async forEach function taken from p-iteration
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

// read a file, the firefox extension way
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

// return misspelt words and suggestions
function checkSpelling (spell, content) {
  const spelling = {
    suggestions: {},
    misspeltWords: []
  }

  // split string by spaces and strip out punctuation that does not form part of the word itself
  // then remove any strings that are numbers or less than 1 char in length
  const cleanedContent = content.split(/(?:\s)/)
    .reduce((acc, string) => acc.concat([string.replace(/(\B\W|\W\B|\s)/gm, '')]), [])
    .reduce((acc, string) => {
      return string.length > 1 && isNaN(string) && !string.includes('@')
        ? acc.concat([string])
        : acc
    }, [])

  console.log(cleanedContent)

  for (const string of cleanedContent) {
    if (!spell.correct(string)) {
      spelling.suggestions[string] = spell.suggest(string)
      spelling.misspeltWords.push(string)
    }
  }

  return spelling
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
  if (node.nodeName === 'INPUT' || node.nodeName === 'TEXTAREA') {
    return node.value
  } else {
    return node.innerText
  }
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
      // prevent race condition when reading files changing the preferred language order
      prefs = prefs.filter((value) => value !== lang)
    }
  }).then(function () {
    return { dicts, prefs }
  }).catch(function (err) {
    console.log(err)
  })
}

// underline all misspelt words by wrapping them in 'u' tags
// see https://codersblock.com/blog/highlight-text-inside-a-textarea/
function underline (words, node) {}

module.exports = {
  checkSpelling,
  debounce,
  getText,
  loadDictionariesAndPrefs,
  underline
}

},{}]},{},[1]);
