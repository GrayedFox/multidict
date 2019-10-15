const carousel = document.querySelector('.suggestions')
const cells = carousel.querySelectorAll('.suggestion')
const cellHeight = carousel.offsetHeight
const cellCount = cells.length
let radius, theta, selectedIndex = 0 // eslint-disable-line one-var

function rotateCarousel () {
  const angle = theta * selectedIndex * -1
  let current = Math.abs(selectedIndex % cellCount)

  if (selectedIndex < 0 && current !== 0) {
    current = cellCount - current
  }

  for (let i = 0; i < cellCount; i++) {
    const next = current + 1 === cellCount ? 0 : current + 1
    let opacity = null
    switch (i) {
      case current:
        opacity = 1
        break
      case next:
        opacity = cellCount > 2 ? 0.3 : 0
        break
      default:
        opacity = 0.3
    }
    carousel.children[i].style.opacity = opacity
  }

  carousel.style.transform = `translateZ(${-radius}px) rotateX(${angle}deg)`
}

const prevButton = document.querySelector('.previous-button')
prevButton.addEventListener('click', () => {
  selectedIndex--
  rotateCarousel()
})

const nextButton = document.querySelector('.next-button')
nextButton.addEventListener('click', () => {
  selectedIndex++
  rotateCarousel()
})

function changeCarousel () {
  theta = 360 / cellCount
  radius = Math.round((cellHeight / 2) / Math.tan(Math.PI / cellCount))
  radius = Math.sign(radius) < 1 ? 0 : radius
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    const cellAngle = theta * i
    cell.style.transform = `rotateX(${cellAngle}deg) translateZ(${radius}px)`
  }

  rotateCarousel()
}

changeCarousel()
