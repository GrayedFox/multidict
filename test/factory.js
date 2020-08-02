const { JSDOM } = require('jsdom')

const jsdomOptions = { resources: 'usable', runScripts: 'dangerously', includeNodeLocations: true }
const domString = '<!DOCTYPE html><html><head></head><body></body></html>'
const dom = new JSDOM(domString, jsdomOptions)
const body = dom.window.document.body

// create and append a node to a persistent DOM containing the specified element
const nodeFactory = function (elementHTMLString) {
  body.appendChild(JSDOM.fragment(elementHTMLString))
  const node = body.lastChild
  return node
}

const getDom = function () { return dom }

module.exports = {
  getDom,
  nodeFactory
}
