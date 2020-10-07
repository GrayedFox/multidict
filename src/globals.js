/**
 * Global methods.
 * @namespace Globals
 */

function extendArrayPrototype () {
  if (!Array.prototype.remove) {
    /**
     * Remove the first instance of a primitive inside an array. This extends the native array
     * prototype. Operates on the array in place.
     *
     * @memberof Globals
     * @param  {*} primitive - the primitive to be removed from the array
     * @returns {Array|undefined} The modified array if removal successful, otherwise undefined
     */
    Array.prototype.remove = function remove (primitive) { // eslint-disable-line no-extend-native
      if (!this || !Array.isArray(this)) {
        throw new TypeError()
      }
      if (this.includes(primitive) || this.indexOf(primitive) !== -1) {
        this.splice(this.indexOf(primitive), 1)
        return this
      }
    }
  }
}

extendArrayPrototype()

module.exports = { extendArrayPrototype }
