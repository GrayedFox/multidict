const nspell = require('./deps/nspell/index.js')
const { cleanText, createClassyElement, css, getRelativeBoundaries } = require('./helpers.js')

const ID = 'multidict'

// A Spelling contains raw text, cleaned text, misspelt Words, and suggestions according to a
// specific language (i.e. a single nspell/speller instance)
class Spelling {
  constructor (speller, content) {
    this.content = content // raw text string 'Hello c137! 1234 C137? email@fu.com'
    this.speller = speller // an nspell instance
    this.cleanedText = cleanText(content) // array of cleaned text ['Hello', 'c137', 'C137']
    this.misspeltWords = this.checkSpelling() // array of misspelt Words [{Word}, {Word}]
    this.suggestions = this._generateSuggestions() // suggestion object (see generator)
  }

  // returns array of misspelt words by checking the spelling of each bit of cleaned text
  checkSpelling () {
    let index = 0
    return this.cleanedText.reduce((acc, word) => {
      if (!this.speller.correct(word)) {
        index = this.content.indexOf(word, index + word.length)
        acc = acc.concat([new Word(word, ...getRelativeBoundaries(word, this.content, index))])
      }
      return acc
    }, [])
  }

  // return the top N suggestions for a misspelt word
  getSuggestions (word, limit = 9) {
    return this.suggestions[word].suggestedWords.slice(0, limit)
  }

  // generates a suggestions object: { misspeltWord: { suggestions: ['word1', 'word2'], count: 1 }}
  // should only be called on class instantiation (count is amount of times a misspelt word appears)
  _generateSuggestions () {
    this.suggestions = {}
    for (let i = 0; i < this.misspeltWords.length; i++) {
      const word = this.misspeltWords[i].text
      const suggestedWords = this.speller.suggest(word)
      if (this.suggestions[word]) {
        this.suggestions[word].count++
      }

      if (suggestedWords.length > 0) {
        this.suggestions[word] = { suggestedWords, count: 1 }
      }
    }

    return this.suggestions
  }
}

// A User has user dictionaries, preferences, spelling instances, and custom words
class User {
  constructor (dictionaries, prefs, languages, ownWords) {
    this.dicts = dictionaries // dictionary objects [{ language: 'en-au', dic: '', aff: '' }]
    this.prefs = prefs // shorthand language strings ['au', 'de', 'gb']
    this.langs = languages // language strings ['en-au', 'de-de', 'en-gb']
    this.ownWords = ownWords // word strings ['kablam', 'shizzle']
    this.spellers = this._createSpellers() // nspell instances by pref (language) { pref: nspell }
  }

  // get the user's preferred (or default) language when spell checking content
  getPreferredLanguage (contentLanguage) {
    for (const pref of this.prefs) {
      if (this.langs.includes(`${contentLanguage}-${pref}`)) {
        return pref
      }
    }
    return this.prefs[0]
  }

  // add word to user.ownWords and update existing spell checker instances
  addWord (word) {
    this.ownWords.push(word)
    Object.keys(this.spellers).forEach((language) => { this.spellers[language].add(word) })
  }

  // remove word from user.ownWords and update existing spell checker instances
  removeWord (word) {
    this.ownWords.remove(word)
    Object.keys(this.spellers).forEach((language) => { this.spellers[language].remove(word) })
  }

  // create spell checkers in order of languages specified by user
  // should only be called once during class instantiation
  _createSpellers () {
    if (this.prefs.length !== this.dicts.length) {
      console.warn('MultiDict: Language prefs and user dictionary length not equal. Aborting.')
      return
    }

    this.spellers = {}

    for (let i = 0; i < this.dicts.length; i++) {
      this.spellers[this.prefs[i]] = nspell(this.dicts[i])
    }

    const spellingLangs = Object.keys(this.spellers)

    if (this.ownWords.length > 0) {
      Object.values(this.ownWords).forEach((word) => {
        spellingLangs.forEach((language) => this.spellers[language].add(word))
      })
    }

    return this.spellers
  }
}

// A Word is an iterable class that contains some text, its length, and word boundaries
class Word {
  constructor (word, start, end) {
    this.text = word
    this.start = Number.parseInt(start)
    this.end = Number.parseInt(end)
    this.length = word.length
  }

  // the word is valid if the length of the word is greater than 0
  isValid () {
    return this.length > 0
  }

  // make Word iterable (values only)
  [Symbol.iterator] () {
    return [this.text, this.start, this.end].values()
  }
}

// A WordCarousel is a page/tab agnostic collection of HTML elements that together form a
// vertically navigatable word carousel inserted into a given node overlaying a specific mark
class WordCarousel {
  constructor (node, mark, suggestedWords) {
    this.node = node // an editable HTML node that we assume the user is currently editing
    this.mark = mark // the exact HTML mark to be used to position the word carousel
    this.suggestedWords = suggestedWords.slice(0, 4) // array of up to 4 words ['word1', 'word2']
    this.acceptedWord = undefined // user chosen word string, can be cleared
    this.currentWord = undefined // active/visible word displayed by carousel
    this.currentSuggestionNode = undefined // active/visible suggestion node displayed by carousel
    this.wordCount = this.suggestedWords.length // amount of words/cells inside the carousel
    this.opacity = this.wordCount > 2 ? 0.3 : 0 // used to set opacity of inactive/non-focused words
    this.theta = 360 / this.wordCount //
    this.suggestionsIndex = 0 // used to keep track of which suggestion is being shown
    this.suggestionsContainer = createClassyElement('div', [`${ID}-suggestions-container`])
    this.suggestionsFrame = createClassyElement('div', [`${ID}-suggestions-frame`])
    this.suggestionsWrapper = createClassyElement('div', [`${ID}-suggestions-wrapper`])

    this._buildCarousel()
  }

  showSuggestions () {
    this.suggestionsWrapper.visibility = null
    this.node.style.filter = 'blur(2px)'
    this.mark.style.visibility = 'hidden'
  }

  hideSuggestions () {
    this.suggestionsWrapper.visibility = 'hidden'
    this.node.style.filter = null
    this.mark.style.visibility = null
  }

  get showingSuggestions () {
    return (this.suggestionsWrapper.visibility !== 'hidden')
  }

  destroy () {
    this.suggestionsWrapper.remove()
  }

  // rotate carousel up/down, set opacity, and update accepted and current words
  rotateCarousel (direction) {
    this.currentSuggestionNode.style.opacity = this.opacity
    direction === 'up' ? this.suggestionsIndex-- : this.suggestionsIndex++
    const angle = this.theta * this.suggestionsIndex * -1

    // suggestionsIndex can be negative/greater than wordCount which allows for infinite scrolling
    let current = Math.abs(this.suggestionsIndex % this.wordCount)
    if (this.suggestionsIndex < 0 && current !== 0) {
      current = this.wordCount - current
    }

    this.currentWord = this.suggestedWords[current]
    this.acceptedWord = this.currentWord
    this.currentSuggestionNode = this.suggestionsFrame.children[current]
    this.currentSuggestionNode.style.opacity = 1.0
    this.suggestionsFrame.style.transform = `translateZ(${-this.radius}px) rotateX(${angle}deg)`
  }

  // build the WordCarousel html elements, position them, and then insert them into the DOM
  // should only be called once during class instantiation
  _buildCarousel () {
    const styles = window.getComputedStyle(this.node)
    const suggestionsProps = css(styles, [
      'color', 'font-size', 'font-family', 'font-weight', 'letter-spacing', 'line-height'
    ])

    this.suggestionsFrame = css(this.suggestionsFrame, suggestionsProps, true)
    this.suggestionsFrame.style.height = suggestionsProps['font-size']
    this.suggestionsFrame.style['line-height'] = suggestionsProps['font-size']

    this.suggestionsWrapper.append(this.suggestionsContainer)
    this.suggestionsContainer.append(this.suggestionsFrame)
    this.mark.prepend(this.suggestionsWrapper)

    const words = this.suggestedWords
    const heightOffset = this.suggestionsContainer.offsetHeight

    this.radius = Math.round((heightOffset / 2) / Math.tan(Math.PI / this.wordCount))
    this.radius = Math.sign(this.radius) < 1 ? 0 : this.radius

    for (let i = 0; i < this.wordCount; i++) {
      const angle = this.theta * i
      const suggestion = createClassyElement('div', [`${ID}-suggestion`])
      suggestion.innerText = words[i]
      suggestion.style.opacity = this.opacity
      suggestion.style.transform = `rotateX(${angle}deg) translateZ(${this.radius}px)`
      this.suggestionsFrame.append(suggestion)
    }

    this.currentSuggestionNode = this.suggestionsFrame.children[this.suggestionsIndex]
  }
}

module.exports = {
  Spelling,
  User,
  Word,
  WordCarousel
}
