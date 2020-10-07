const sinon = require('sinon')
const browser = require('sinon-chrome/extensions')
const I18nPlugin = require('sinon-chrome/plugins').I18nPlugin
const { assert } = require('chai')
const helpers = require('../src/helpers')

// helper function that allows test to wait for async operations to finish (promise allows use of await)
const promiseWait = (timeout) => { return new Promise((resolve, reject) => { setTimeout(() => resolve(), timeout) }) }

// helper function that asserts that each node has a property with a given value
const assertOrderedValues = (nodeList, property, values) => {
  for (let i = 0; i < nodeList.length; i++) { assert.strictEqual(nodeList[i][property], values[i], `${property} for node ${nodeList[i]} is strictly equal to ${values[i]}`) }
}
// helper function that asserts that every single node inside nodeList has attribute set to value
const assertAttributeValue = (nodeList, attribute, value) => assert.isTrue(Array.from(nodeList).map(n => n.getAttribute(attribute)).every(element => element === value))

// helpers that rely on the web-extension API (need to be stubbed)
describe('Helpers: Web-Extension API', function () {
  const { createMenuItems, getDefaultLanguages, notify } = helpers

  const title = 'scroodle'
  const message = 'It\'s raining men!'

  let languages

  before(async function () {
    global.browser = browser // need to patch global browser with mocked api
    browser.menus = browser.contextMenus // sinon-chrome doesn't wrap this method as it should
    browser.registerPlugin(new I18nPlugin()) // sinon-chrome must register i18n first for stubs to work

    sinon.stub(browser.i18n, 'getAcceptLanguages').resolves(['de-de', 'en-au'])
    sinon.stub(browser.i18n, 'getUILanguage').returns('en-en')
    sinon.spy(browser.menus, 'create', ['get'])
    sinon.spy(browser.notifications, 'create', ['get'])

    createMenuItems()
    notify(title, message)
    languages = await getDefaultLanguages()
  })

  it('asserts that createMenuItems() calls browser.menus.create() twice', function () {
    assert.strictEqual(browser.menus.create.callCount, 2)
  })

  it('asserts that createMenuItems() calls browser.menus.create() with "selection" as context', function () {
    assert.sameMembers(browser.menus.create.getCall(0).args[0].contexts, ['selection'])
    assert.sameMembers(browser.menus.create.getCall(1).args[0].contexts, ['selection'])
  })

  it('asserts that notify() calls browser.notifications.create() with correct title and message', function () {
    assert.strictEqual(browser.notifications.create.getCall(0).args[1].title, title)
    assert.strictEqual(browser.notifications.create.getCall(0).args[1].message, message)
  })

  it('asserts that notify() calls browser.notifications.create() just once', function () {
    assert.strictEqual(browser.notifications.create.callCount, 1)
  })

  it('asserts that notify() calls browser.notifications.create() using title as id', function () {
    assert.strictEqual(browser.notifications.create.getCall(0).args[0], title)
  })

  it('asserts that getDefaultLanguages() returns an array of strings', function () {
    assert.isTrue(languages.every(x => typeof x === 'string'))
  })

  it('asserts that getDefaultLanguages() includes UI and i18n languages', function () {
    assert.sameMembers(languages, ['de-de', 'en-en', 'en-au'])
  })
})

// Helpers that rely on the DOM and browser environment
describe('Helpers: Browser Methods', function () {
  const { blinkNode, flattenAllChildren, isSupported, setNodeListAttributes } = helpers
  const { nodeFactory, getDom } = require('./factory')

  let divWithNestedChildren
  let mark
  let dom
  let textarea

  before(function () {
    divWithNestedChildren = nodeFactory('<div><h2></h2><textarea></textarea><mark><mark></mark></mark></div>')
    mark = nodeFactory('<mark></mark>')
    textarea = nodeFactory('<textarea></textarea>')
    dom = getDom()
  })

  it('asserts that blinkNode() calls classList.remove at least N times', async function () {
    sinon.spy(mark.classList, 'remove')
    blinkNode(mark, 3)
    await promiseWait(750)
    assert.isAtLeast(mark.classList.remove.callCount, 3)
  })

  it('asserts that blinkNode() class classList.add at least N times', async function () {
    sinon.spy(mark.classList, 'add')
    blinkNode(mark, 4)
    await promiseWait(750)
    assert.isAtLeast(mark.classList.add.callCount, 4)
  })

  it('asserts that flattenAllChildren() returns array with correct ordered members when passed a node', function () {
    const flat = flattenAllChildren(divWithNestedChildren)
    assertOrderedValues(flat, 'nodeName', ['DIV', 'H2', 'TEXTAREA', 'MARK', 'MARK'])
    assert.strictEqual(flat.length, 5)
  })

  it('asserts that flattenAllChildren() returns array with correct members when passed a nodeList', function () {
    const flat = flattenAllChildren(dom.window.document.querySelectorAll('div'))
    assertOrderedValues(flat, 'nodeName', ['DIV', 'H2', 'TEXTAREA', 'MARK', 'MARK'])
    assert.strictEqual(flat.length, 5)
  })

  it('asserts that flattenAllChildren() returns array with correct members when passed an array of nodes', function () {
    const flat = flattenAllChildren([divWithNestedChildren, mark])
    assertOrderedValues(flat, 'nodeName', ['DIV', 'H2', 'TEXTAREA', 'MARK', 'MARK', 'MARK'])
    assert.strictEqual(flat.length, 6)
  })

  it('asserts that isSupported() returns true for textareas', function () {
    assert.strictEqual(isSupported(textarea), true)
  })

  it('asserts that isSupported() returns false for divs and marks', function () {
    assert.strictEqual(isSupported(mark), false)
    assert.strictEqual(isSupported(divWithNestedChildren), false)
  })

  it('asserts that setNodeListAttributes() sets attributes when passed a node', function () {
    setNodeListAttributes(textarea, { spellcheck: false, hidden: true })
    assert.strictEqual(textarea.getAttribute('spellcheck'), 'false')
    assert.strictEqual(textarea.getAttribute('hidden'), 'true')
  })

  it('asserts that setNodeListAttributes() sets attributes when passed a nodeList', function () {
    const marks = dom.window.document.querySelectorAll('mark')
    setNodeListAttributes(marks, { opacity: 0.8, hidden: true })
    assertAttributeValue(marks, 'opacity', '0.8')
    assertAttributeValue(marks, 'hidden', 'true')
  })

  it('asserts that setNodeListAttributes() sets attributes when passed an array of nodes', function () {
    setNodeListAttributes([textarea, divWithNestedChildren], { opacity: 0.5, border: '8px' })
    assertAttributeValue([textarea, divWithNestedChildren], 'opacity', '0.5')
    assertAttributeValue([textarea, divWithNestedChildren], 'border', '8px')
  })
})

// Helpers that should work in any JavaScript environment
describe('Helpers: Native', function () {
  const { debounce, prepareLanguages } = helpers

  const delay = 50
  // each call to debounceFn will update the testVar value only after the specified delay - see
  // the debounce JSDOC comment to understand the behaviour of a debounced function
  const debouncedFn = debounce(function (value) { testVar = value }, delay)

  let testVar = null

  it('asserts that debounce() delays the execution of a callback', async function () {
    debouncedFn('fish')
    assert.strictEqual(testVar, null, 'testVar equals null')
    await promiseWait(delay)
    assert.strictEqual(testVar, 'fish', 'testVar equals fish')
  })

  it('asserts that debounce() further delays the execution of a callback when debouncedFn called twice', async function () {
    debouncedFn(true)
    assert.strictEqual(testVar, 'fish', 'testVar still equals fish')
    await promiseWait(delay / 2)
    debouncedFn(true)
    await promiseWait(delay / 2)
    assert.strictEqual(testVar, 'fish', 'testVar still equals fish after debouncing again')
    await promiseWait(delay)
    assert.strictEqual(testVar, true, 'testVar equals true')
  })

  it('asserts that debounce() errors if not passed a function', function () {
    assert.throws(() => debounce('derp', delay), TypeError)
  })

  it('asserts that prepareLanguages() does not add duplicate languages to array', function () {
    assert.sameMembers(prepareLanguages(['de-de', 'de-de', 'de']), ['de-de'])
  })

  it('asserts that prepareLanguages() uses language as locale for shortform language codes', function () {
    assert.sameMembers(prepareLanguages(['de', 'en-au', 'fr']), ['de-de', 'en-au', 'fr-fr'])
  })

  it('asserts that prepareLanguages() lowercases all languages', function () {
    assert.sameMembers(prepareLanguages(['De', 'EN-au', 'fr-FR']), ['de-de', 'en-au', 'fr-fr'])
  })

  it('asserts that prepareLanguages() returns languages in same order they are given', function () {
    assert.sameOrderedMembers(prepareLanguages(['de', 'en-au', 'fr-fr']), ['de-de', 'en-au', 'fr-fr'])
  })
})
