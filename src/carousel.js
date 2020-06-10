/**
 * The Carousel module inserts itself into the shadow dom of a given node. It doesn't have any
 * listeners but comes with control methods to show, hide, or rotate it. It will reduce the opacity
 * of non active cells as they rotate out of focus to highlight the current cell. When destroyed it
 * will return the current cell. The desired cellHeight is required for instantiation.
**/

class Carousel {
  /**
   * @constructor
   * @param  {node} node - The node the carousel will attach itself to
   * @param  {array} content - An array of valid DOM strings used to set the innerHTML of each cell
   * @param  {number} cellHeight - The height (assumed unit is pixels) used for each cell
   * @param {object} position - An object containing key value pairs used to position the carousel
   * based on the parent node
   * @returns {node} Carousel
   */

  constructor (node, content, cellHeight, position) {
    this.$node = node
    this.content = content
    this.cellHeight = cellHeight
    this.position = position
    this._nodeStyles = window.getComputedStyle(node)
    this._theta = 360 / this.content.length
    this._translateZ = 0 // value set when building carousel
    this._selectedIndex = 0 // used to spin the carousel up or down
    this._getCurrentCellIndex = this._getCurrentCellIndex.bind(this)
    this._setCurrentCell = this._setCurrentCell.bind(this)
    this._setPreviousCell = this._setPreviousCell.bind(this)
    this.destroy = this.destroy.bind(this)
    this.rotate = this.rotate.bind(this)
    this.$carousel = null

    this._buildCarousel()
  }

  get currentCell () {
    return this._currentCell
  }

  get previousCell () {
    return this._previousCell
  }

  get visible () {
    return this._visible
  }

  set visible (boolean) {
    if (boolean) {
      this.$carousel.style.visibility = 'visible'
    } else {
      this.$carousel.style.visibility = 'hidden'
    }
    this._visible = boolean
  }

  _getCurrentCellIndex () {
    let currentCellIndex = Math.abs(this._selectedIndex % this.content.length)
    // selectedIndex can be negative/greater than content.length (allows for infinited scrolling)
    if (this._selectedIndex < 0 && currentCellIndex !== 0) {
      currentCellIndex = this.content.length - currentCellIndex
    }
    // the plus one accounts for fact that selectedIndex is 0 based
    return currentCellIndex + 1
  }

  _setPreviousCell (cellIndex) {
    const cell = this.$carousel.shadowRoot.querySelector(`#conveyer .cell:nth-child(${cellIndex})`)
    this._previousCell = cell
  }

  _setCurrentCell (cellIndex) {
    const cell = this.$carousel.shadowRoot.querySelector(`#conveyer .cell:nth-child(${cellIndex})`)
    this._currentCell = cell
  }

  _setOpaqueness () {
    this._previousCell.style.opacity = null
    this._currentCell.style.opacity = 1.0
  }

  _buildCarousel () {
    this.$carousel = document.createElement('div')
    this.$carousel.attachShadow({ mode: 'open' })
    this.$carousel.shadowRoot.innerHTML = `
    <style>
    :host(div) {
      position: absolute;
      display: inline-flex;
    }
    #scene {
      position: relative;
      perspective: 1200px;
      z-index: 1
    }
    #conveyer {
      width: 100%;
      height: 100%;
      position: absolute;
      transform-style: preserve-3d;
      transition: transform 1s;
      min-height: ${this.cellHeight}px;
    }
    .cell {
      position: absolute;
      transition: transform 1s, opacity 1s;
      opacity: ${this.content.length > 2 ? 0.3 : 0};
      height: ${this.cellHeight}px;
    }
    </style>

    <div id="scene"><div id="conveyer"></div></div>
    `

    this.$scene = this.$carousel.shadowRoot.querySelector('#scene')
    this.$conveyer = this.$carousel.shadowRoot.querySelector('#conveyer')
    this.$carousel.setAttribute('class', 'data-multidict-suggestions')

    this._translateZ = Math.round((this.cellHeight / 2) / Math.tan(Math.PI / this.content.length))
    // this prevents the translateZ value going bananas when there is only 1 cell with which to
    // build the carousel
    this._translateZ = Math.sign(this._translateZ) < 1 ? 0 : this._translateZ

    let angle, cell

    for (let i = 0; i < this.content.length; i++) {
      angle = this._theta * i
      cell = document.createElement('div')
      cell.setAttribute('class', 'cell')
      cell.style.transform = `rotateX(${angle}deg) translateZ(${this._translateZ}px)`
      cell.innerHTML = this.content[i]
      this.$conveyer.appendChild(cell)
    }

    for (const [key, value] of Object.entries(this.position)) {
      this.$scene.style[key] = value
    }

    // display value needs to be set to block if node we are positioning off has that value
    if (this._nodeStyles.getPropertyValue('display') === 'block') {
      this.$carousel.style.display = 'block'
    }

    this.visible = true
    this.$node.insertAdjacentElement('beforebegin', this.$carousel)
  }

  destroy () {
    this.$carousel.visible = false
    this.$carousel.remove()
    return this.currentCell
  }

  render () {
    this._setOpaqueness()
  }

  // rotate the conveyer up or down and updates previous and current cells
  rotate (direction) {
    this._setPreviousCell(this._getCurrentCellIndex())
    direction === 'up' ? this._selectedIndex++ : this._selectedIndex--
    this._setCurrentCell(this._getCurrentCellIndex())

    const angle = this._theta * this._selectedIndex * -1
    this.$conveyer.style.transform = `translateZ(${-this._translateZ}px) rotateX(${angle}deg)`
    this.render()
  }
}

module.exports = { Carousel }
