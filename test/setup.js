require('../src/globals') // extensions/polyfill

const { readFile } = require('fs')
const { promisify } = require('util')
const sinon = require('sinon')

afterEach(function () {
  sinon.restore()
})

module.exports = {
  readFile: promisify(readFile)
}
