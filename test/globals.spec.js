const { assert } = require('chai')
const { extendArrayPrototype } = require('../src/globals')

describe('Global Array.remove() Method', function () {
  const stringArray = ['kablam', 'shizzle', undefined, 'awesome-sauce']
  const numberArray = [5, 3, 1]
  const objectArray = [{ me: 1 }, { you: 'two' }, { us: true }]

  it('should assert that Array.prototype.remove is not overwritten by extension if defined', function () {
    Array.prototype.remove = 'something' // eslint-disable-line no-extend-native
    extendArrayPrototype()
    assert.typeOf(Array.prototype.remove, 'string')
  })

  it('should assert that Array.prototype is extended with remove() method if undefined', function () {
    Array.prototype.remove = undefined // eslint-disable-line no-extend-native
    extendArrayPrototype()
    assert.typeOf(Array.prototype.remove, 'function')
  })

  it('should assert that calling remove() with undefined this throws a TypeError', function () {
    assert.throws(() => Array.prototype.remove.call(this, undefined), TypeError)
  })

  it('should assert that calling remove() on a string throws a TypeError', function () {
    assert.throws(() => Array.prototype.remove.call(undefined, 'hello'), TypeError)
  })

  it('should assert that calling remove() on an array of strings removes the correct element', function () {
    stringArray.remove('awesome-sauce')
    assert.sameMembers(stringArray, ['kablam', 'shizzle', undefined])
  })

  it('should assert that calling remove() on an array of numbers removes the correct element', function () {
    numberArray.remove(1)
    assert.sameMembers(numberArray, [5, 3])
  })

  it('should assert that calling remove() on an array of objects removes the correct element', function () {
    objectArray.remove(1)
    assert.property(objectArray[0], 'me')
    assert.property(objectArray[1], 'us')
  })

  it('should assert that calling remove() returns undefined if removal is unsuccessful', function () {
    assert.equal(numberArray.remove(7), undefined)
    assert.equal(stringArray.remove(0.123), undefined)
    assert.equal(objectArray.remove('hello'), undefined)
  })
})
