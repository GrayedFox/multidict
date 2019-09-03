// promisifed async custom forEach function taken from p-iteration
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

module.exports = {
  loadDictionaries
}
