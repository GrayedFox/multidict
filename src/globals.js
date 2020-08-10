/**
 * Global methods.
 * @namespace Globals
 */

function extendArrayPrototype () {
  if (!Array.prototype.remove) {
    /**
     * Remove the first instance of an item inside an array. This extends native array prototype.
     * Operates on the array in place.
     *
     * @memberof Globals
     * @param  {*} item - the item to be removed from the array
     * @returns {Array|undefined} An array if removal successful, otherwise undefined
     */
    Array.prototype.remove = function remove (item) { // eslint-disable-line no-extend-native
      if (!this || !Array.isArray(this)) {
        throw new TypeError()
      }

      if (this.includes(item) || this.indexOf(item) !== -1) {
        this.splice(this.indexOf(item), 1)
        return this
      }

      // handles cases where item is a finite index and element at given index is defined
      if (typeof this[item] !== 'undefined' && item >= 0 && Number.isFinite(item)) {
        this.splice(item, 1)
        return this
      }
    }
  }
}

extendArrayPrototype()

module.exports = { extendArrayPrototype }
