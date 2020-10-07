const { assert } = require('chai')
const { extendArrayPrototype } = require('../src/globals')

describe('Global Array.prototype.remove() Method', function () {
  const stringArray = ['kablam', 'shizzle', undefined, 'awesome-sauce']
  const numberArray = [5, 3, 1, 9, 0.123]
  const objectArray = [{ me: 1 }, { you: 'two' }, { us: true }]
  const primitiveArray = ['hello', null, undefined, false, true, 0, 1]

  it('should assert that all primitive types are able to be removed by method', function () {
    primitiveArray.remove('hello')
    primitiveArray.remove(null)
    primitiveArray.remove(undefined)
    primitiveArray.remove(false)
    primitiveArray.remove(true)
    primitiveArray.remove(0)
    primitiveArray.remove(1)
    assert.sameMembers(primitiveArray, [])
  })

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
    numberArray.remove(0)
    assert.sameMembers(numberArray, [5, 3, 9, 0.123])
  })

  it('should assert that calling remove() and passing an object or array does nothing', function () {
    objectArray.remove({})
    objectArray.remove([])
    assert.propertyVal(objectArray[0], 'me', 1)
    assert.propertyVal(objectArray[1], 'you', 'two')
    assert.propertyVal(objectArray[2], 'us', true)
    assert.equal(objectArray.length, 3)
  })

  it('should assert that calling remove() returns undefined and leaves array unchanged if removal is unsuccessful', function () {
    assert.equal(numberArray.remove(7), undefined)
    assert.sameOrderedMembers(numberArray, [5, 3, 9, 0.123])
    assert.equal(stringArray.remove(0.123), undefined)
    assert.equal(objectArray.remove('hello'), undefined)
    assert.sameOrderedMembers(stringArray, ['kablam', 'shizzle', undefined])
  })

  it('should assert that a successful remove() returns the modified array', function () {
    const arrayCopy = numberArray.remove(5)
    assert.sameOrderedMembers(arrayCopy, numberArray)
  })

  it('should assert that calling remove() on an array without any parameters removes first instance of undefined', function () {
    stringArray.push(undefined)
    assert.sameOrderedMembers(stringArray.remove(), ['kablam', 'shizzle', undefined])
  })

  it('should assert that calling remove() on an array and passing undefined as parameter removes first instance of undefined', function () {
    assert.sameOrderedMembers(stringArray.remove(undefined), ['kablam', 'shizzle'])
  })
})
