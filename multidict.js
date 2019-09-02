const nspell = require('./nspell/index.js')

// promisifed async custom forEach function taken from p-iteration
const forEach = async (array, callback, thisArg) => {
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
        reject(error)
      })
  })
}

// get local dictionary files
async function loadDictionaries (languages) {
  const dictionaries = []
  return forEach(languages, async (lang) => {
    const dic = await readFile(browser.runtime.getURL(`./dictionaries/${lang}.dic`))
    const aff = await readFile(browser.runtime.getURL(`./dictionaries/${lang}.aff`))
    dictionaries.push({ dic: dic, aff: aff })
  }).then(function () {
    return dictionaries
  }).catch(function (err) {
    console.log(err)
  })
}

// main function which loads dictionaries and creates NSpell dictionary intances
async function main (root) {
  const languages = await browser.i18n.getAcceptLanguages()
  const dictionaries = await loadDictionaries(languages)
  const spell = nspell(dictionaries[0])
  console.log('Checking "color" is spelt correctly: ' + spell.correct('color'))
  console.log('Suggesting alternatives: ' + spell.suggest('color'))
  console.log('Checking "colour" is spelt correclty: ' + spell.correct('colour'))
}

main(document)

// Goal: enable multiple laguages to be used when spell checking
//
// Limits: no way to directly interact right now with browser dictionary list so have to build
// spell check/lookup functionality
//
// Method: user should disable browser spell check (to avoid annoying/false red lines) and rely
// on the extension
//
// MVP: spell check using dictionaries, underline misspelled words in multiple
// languages
// V2: show suggestions
// V3: show grammatical errors
