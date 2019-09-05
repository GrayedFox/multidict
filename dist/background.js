(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const nspell = require('./deps/nspell/index.js')
const { checkSpelling, loadDictionariesAndPrefs } = require('./helpers.js')

let messageHandler
let languages = []
let languagePrefs = []
let spells = {}

// create spell checkers in order of languages specified by user
function createSpellCheckers (user) {
  if (languagePrefs.length !== user.dicts.length) {
    console.warn('Language prefs and user dictionary length are not equal. Aborting.')
    return
  }

  const spellCheckers = {}

  for (let i = 0; i < user.dicts.length; i++) {
    spellCheckers[languagePrefs[i]] = nspell(user.dicts[i])
  }

  return spellCheckers
}

// handles all incoming messages from the content script
function listener (message) {
  messageHandler = message
  messageHandler.postMessage({ greeting: 'MultDict connection established' })

  // content script message object should contain: { name, language, content }
  messageHandler.onMessage.addListener((message) => {
    if (message.language === 'unreliable') {
      messageHandler.postMessage({
        suggestions: checkSpelling(spells[languagePrefs[0]], message.content)
      })
    } else {
      for (const pref of languagePrefs) {
        if (languages.includes(`${message.language}-${pref}`)) {
          messageHandler.postMessage({
            spelling: checkSpelling(spells[pref], message.content)
          })
          break
        }
      }
    }
  })
}

// main function loads dictionaries, sets langauge prefs, and creates NSpell dictionary instances
async function main () {
  languages = await browser.i18n.getAcceptLanguages()
  const user = await loadDictionariesAndPrefs(languages)
  languagePrefs = user.prefs.reduce((acc, lang) => acc.concat([lang.slice(3, 5)]), [])
  spells = createSpellCheckers(user)

  console.log(languages)
  console.log(languagePrefs)
}

browser.runtime.onConnect.addListener(listener)

main()

// Goal: enable multiple laguages to be used when spell checking
//
// Limits: no way to directly interact right now with browser dictionary list so have to build
// spell check/lookup functionality
//
// Method: user should disable browser spell check (to avoid annoying/false red lines) and rely
// on the extension
//
// MVP: spell check using dictionaries, detect language of each field, underline misspelled words,
// show suggestions
// V2: persistent personal dictionary to add words to

},{"./deps/nspell/index.js":5,"./helpers.js":22}],2:[function(require,module,exports){
'use strict'

var push = require('./util/add.js')

module.exports = add

var own = {}.hasOwnProperty

// Add `value` to the checker.
function add (value, model) {
  var self = this
  var dict = self.data
  var codes = model && own.call(dict, model) ? dict[model].concat() : []

  push(dict, value, codes, self)

  return self
}

},{"./util/add.js":10}],3:[function(require,module,exports){
'use strict'

var form = require('./util/form.js')

module.exports = correct

// Check spelling of `value`.
function correct (value) {
  return Boolean(form(this, value))
}

},{"./util/form.js":17}],4:[function(require,module,exports){
'use strict'

var parse = require('./util/dictionary.js')

module.exports = add

// Add a dictionary file.
function add (buf) {
  var self = this
  var compound = self.compoundRules
  var compoundCodes = self.compoundRuleCodes
  var index = -1
  var length = compound.length
  var rule
  var source
  var character
  var offset
  var count

  parse(buf, self, self.data)

  // Regenerate compound expressions.
  while (++index < length) {
    rule = compound[index]
    source = ''

    offset = -1
    count = rule.length

    while (++offset < count) {
      character = rule.charAt(offset)

      if (compoundCodes[character].length === 0) {
        source += character
      } else {
        source += '(?:' + compoundCodes[character].join('|') + ')'
      }
    }

    compound[index] = new RegExp(source, 'i')
  }

  return self
}

},{"./util/dictionary.js":14}],5:[function(require,module,exports){
'use strict'

var affix = require('./util/affix.js')

module.exports = NSpell

var proto = NSpell.prototype

proto.correct = require('./correct.js')
proto.suggest = require('./suggest.js')
proto.spell = require('./spell.js')
proto.add = require('./add.js')
proto.remove = require('./remove.js')
proto.wordCharacters = require('./word-characters.js')
proto.dictionary = require('./dictionary.js')
proto.personal = require('./personal.js')

// Construct a new spelling context.
function NSpell (aff, dic) {
  var length
  var index
  var dictionaries

  if (!(this instanceof NSpell)) {
    return new NSpell(aff, dic)
  }

  if (typeof aff === 'string') {
    if (typeof dic === 'string') {
      dictionaries = [{ dic: dic }]
    }
  } else if (aff) {
    if ('length' in aff) {
      dictionaries = aff
      aff = aff[0] && aff[0].aff
    } else {
      if (aff.dic) {
        dictionaries = [aff]
      }

      aff = aff.aff
    }
  }

  if (!aff) {
    throw new Error('Missing `aff` in dictionary')
  }

  aff = affix(aff)

  this.data = {}
  this.compoundRuleCodes = aff.compoundRuleCodes
  this.replacementTable = aff.replacementTable
  this.conversion = aff.conversion
  this.compoundRules = aff.compoundRules
  this.rules = aff.rules
  this.flags = aff.flags

  length = dictionaries ? dictionaries.length : 0
  index = -1

  while (++index < length) {
    dic = dictionaries[index]

    if (dic && dic.dic) {
      this.dictionary(dic.dic)
    }
  }
}

},{"./add.js":2,"./correct.js":3,"./dictionary.js":4,"./personal.js":6,"./remove.js":7,"./spell.js":8,"./suggest.js":9,"./util/affix.js":11,"./word-characters.js":21}],6:[function(require,module,exports){
'use strict'

var trim = require('./util/trim.js')

module.exports = add

// Add a dictionary.
function add (buf) {
  var self = this
  var flags = self.flags
  var lines = buf.toString('utf8').split('\n')
  var length = lines.length
  var index = -1
  var line
  var forbidden
  var word
  var model
  var flag

  // Ensure there’s a key for `FORBIDDENWORD`: `false` cannot be set through an
  // affix file so its safe to use as a magic constant.
  flag = flags.FORBIDDENWORD || false
  flags.FORBIDDENWORD = flag

  while (++index < length) {
    line = trim(lines[index])

    if (!line) {
      continue
    }

    line = line.split('/')
    word = line[0]
    model = line[1]
    forbidden = word.charAt(0) === '*'

    if (forbidden) {
      word = word.slice(1)
    }

    self.add(word, model)

    if (forbidden) {
      self.data[word].push(flag)
    }
  }

  return self
}

},{"./util/trim.js":20}],7:[function(require,module,exports){
'use strict'

module.exports = remove

// Remove `value` from the checker.
function remove (value) {
  var self = this

  self.data[value] = null

  return self
}

},{}],8:[function(require,module,exports){
'use strict'

var form = require('./util/form.js')
var flag = require('./util/flag.js')

module.exports = spell

// Check spelling of `word`.
function spell (word) {
  var self = this
  var dict = self.data
  var flags = self.flags
  var value = form(self, word, true)

  // Hunspell also provides `root` (root word of the input word), and `compound`
  // (whether `word` was compound).
  return {
    correct: self.correct(word),
    forbidden: Boolean(value && flag(flags, 'FORBIDDENWORD', dict[value])),
    warn: Boolean(value && flag(flags, 'WARN', dict[value]))
  }
}

},{"./util/flag.js":16,"./util/form.js":17}],9:[function(require,module,exports){
'use strict'

var trim = require('./util/trim.js')
var casing = require('./util/casing.js')
var normalize = require('./util/normalize.js')
var flag = require('./util/flag.js')
var form = require('./util/form.js')

module.exports = suggest

var noSuggestType = 'NOSUGGEST'

// Suggest spelling for `value`.
// eslint-disable-next-line complexity
function suggest (value) {
  var self = this
  var replacementTable = self.replacementTable
  var conversion = self.conversion
  var groups = self.flags.KEY
  var suggestions = []
  var weighted = {}
  var memory
  var replacement
  var edits = []
  var values
  var index
  var length
  var offset
  var position
  var count
  var otherOffset
  var otherCount
  var otherCharacter
  var character
  var group
  var before
  var after
  var upper
  var insensitive
  var firstLevel
  var prev
  var next
  var nextCharacter
  var max
  var distance
  var end
  var size
  var normalized
  var suggestion
  var currentCase

  value = normalize(trim(value), conversion.in)

  if (!value || self.correct(value)) {
    return []
  }

  currentCase = casing(value)

  // Check the replacement table.
  length = replacementTable.length
  index = -1

  while (++index < length) {
    replacement = replacementTable[index]
    offset = value.indexOf(replacement[0])

    while (offset !== -1) {
      edits.push(value.replace(replacement[0], replacement[1]))
      offset = value.indexOf(replacement[0], offset + 1)
    }
  }

  // Check the keyboard.
  length = value.length
  index = -1

  while (++index < length) {
    character = value.charAt(index)
    insensitive = character.toLowerCase()
    upper = insensitive !== character
    offset = -1
    count = groups.length

    while (++offset < count) {
      group = groups[offset]
      position = group.indexOf(insensitive)

      if (position === -1) {
        continue
      }

      before = value.slice(0, position)
      after = value.slice(position + 1)
      otherOffset = -1
      otherCount = group.length

      while (++otherOffset < otherCount) {
        if (otherOffset !== position) {
          otherCharacter = group.charAt(otherOffset)

          if (upper) {
            otherCharacter = otherCharacter.toUpperCase()
          }

          edits.push(before + otherCharacter + after)
        }
      }
    }
  }

  // Check cases where one of a double character was forgotten, or one too many
  // were added, up to three “distances”.  This increases the success-rate by 2%
  // and speeds the process up by 13%.
  length = value.length
  index = -1
  nextCharacter = value.charAt(0)
  values = ['']
  max = 1
  distance = 0

  while (++index < length) {
    character = nextCharacter
    nextCharacter = value.charAt(index + 1)
    before = value.slice(0, index)

    replacement = character === nextCharacter ? '' : character + character
    offset = -1
    count = values.length

    while (++offset < count) {
      if (offset <= max) {
        values.push(values[offset] + replacement)
      }

      values[offset] += character
    }

    if (++distance < 3) {
      max = values.length
    }
  }

  edits = edits.concat(values)

  // Ensure the lower-cased, capitalised, and uppercase values are included.
  values = [value]
  replacement = value.toLowerCase()

  if (value === replacement) {
    values.push(value.charAt(0).toUpperCase() + replacement.slice(1))
  } else {
    values.push(replacement)
  }

  replacement = value.toUpperCase()

  if (value !== replacement) {
    values.push(replacement)
  }

  // Construct a memory object for `generate`.
  memory = {
    state: {},
    weighted: weighted,
    suggestions: suggestions
  }

  firstLevel = generate(self, memory, values, edits)

  // While there are no suggestions based on generated values with an
  // edit-distance of `1`, check the generated values, `SIZE` at a time.
  // Basically, we’re generating values with an edit-distance of `2`, but were
  // doing it in small batches because it’s such an expensive operation.
  prev = 0
  max = Math.pow(Math.max(15 - value.length, 3), 3)
  max = Math.min(firstLevel.length, max)
  end = Date.now() + Math.min(30 * value.length, 200)
  size = Math.max(Math.pow(10 - value.length, 3), 1)

  while (!suggestions.length && prev < max) {
    next = prev + size
    generate(self, memory, firstLevel.slice(prev, next))
    prev = next

    if (Date.now() > end) {
      break
    }
  }

  // Sort the suggestions based on their weight.
  suggestions.sort(sort)

  // Normalize the output.
  values = []
  normalized = []
  index = -1
  length = suggestions.length

  while (++index < length) {
    suggestion = normalize(suggestions[index], conversion.out)
    suggestions[index] = suggestion
    replacement = suggestion.toLowerCase()

    if (normalized.indexOf(replacement) === -1) {
      values.push(suggestion)
      normalized.push(replacement)
    }
  }

  // BOOM! All done!
  return values

  function sort (a, b) {
    return sortWeight(a, b) || sortCasing(a, b) || sortAlpha(a, b)
  }

  function sortWeight (a, b) {
    if (weighted[a] === weighted[b]) {
      return 0
    }

    return weighted[a] > weighted[b] ? -1 : 1
  }

  function sortCasing (a, b) {
    var leftCasing = casing(a)
    var rightCasing = casing(b)

    if (leftCasing !== rightCasing) {
      if (leftCasing === currentCase) {
        return -1
      }

      if (rightCasing === currentCase) {
        return 1
      }
    }

    return 0
  }

  function sortAlpha (a, b) {
    return a.localeCompare(b)
  }
}

// Get a list of values close in edit distance to `words`.
function generate (context, memory, words, edits) {
  var characters = context.flags.TRY
  var characterLength = characters.length
  var data = context.data
  var flags = context.flags
  var result = []
  var upper
  var length
  var index
  var word
  var position
  var count
  var before
  var after
  var nextAfter
  var nextNextAfter
  var character
  var nextCharacter
  var inject
  var offset

  // Check the pre-generated edits.
  length = edits && edits.length
  index = -1

  while (++index < length) {
    check(edits[index], true)
  }

  // Iterate over given word.
  length = words.length
  index = -1

  while (++index < length) {
    word = words[index]

    before = ''
    character = ''
    nextAfter = word
    nextNextAfter = word.slice(1)
    nextCharacter = word.charAt(0)
    position = -1
    count = word.length + 1

    // Iterate over every character (including the end).
    while (++position < count) {
      before += character
      after = nextAfter
      nextAfter = nextNextAfter
      nextNextAfter = nextAfter.slice(1)
      character = nextCharacter
      nextCharacter = word.charAt(position + 1)
      upper = character.toLowerCase() !== character

      // Remove.
      check(before + nextAfter)

      // Switch.
      if (nextAfter) {
        check(before + nextCharacter + character + nextNextAfter)
      }

      // Iterate over all possible letters.
      offset = -1

      while (++offset < characterLength) {
        inject = characters[offset]

        // Add and replace.
        check(before + inject + after)
        check(before + inject + nextAfter)

        // Try upper-case if the original character was upper-cased.
        if (upper) {
          inject = inject.toUpperCase()

          check(before + inject + after)
          check(before + inject + nextAfter)
        }
      }
    }
  }

  // Return the list of generated words.
  return result

  // Check and handle a generated value.
  function check (value, double) {
    var state = memory.state[value]
    var corrected

    if (state !== Boolean(state)) {
      result.push(value)

      corrected = form(context, value)
      state = corrected && !flag(flags, noSuggestType, data[corrected])

      memory.state[value] = state

      if (state) {
        memory.weighted[value] = double ? 10 : 0
        memory.suggestions.push(value)
      }
    }

    if (state) {
      memory.weighted[value]++
    }
  }
}

},{"./util/casing.js":13,"./util/flag.js":16,"./util/form.js":17,"./util/normalize.js":18,"./util/trim.js":20}],10:[function(require,module,exports){
'use strict'

var apply = require('./apply.js')

module.exports = add

var own = {}.hasOwnProperty

function add (dict, word, codes, options) {
  var flags = options.flags
  var rules = options.rules
  var compoundRuleCodes = options.compoundRuleCodes
  var position
  var length
  var code
  var rule
  var newWords
  var offset
  var newWord
  var subposition
  var combined
  var otherNewWords
  var suboffset
  var wordCount
  var newWordCount

  // Compound words.
  if (!own.call(flags, 'NEEDAFFIX') || codes.indexOf(flags.NEEDAFFIX) === -1) {
    add(word, codes)
  }

  position = -1
  length = codes.length

  while (++position < length) {
    code = codes[position]
    rule = rules[code]

    if (code in compoundRuleCodes) {
      compoundRuleCodes[code].push(word)
    }

    if (rule) {
      newWords = apply(word, rule, rules)
      wordCount = newWords.length
      offset = -1

      while (++offset < wordCount) {
        newWord = newWords[offset]

        add(newWord)

        if (!rule.combineable) {
          continue
        }

        subposition = position

        while (++subposition < length) {
          combined = rules[codes[subposition]]

          if (
            !combined ||
            !combined.combineable ||
            rule.type === combined.type
          ) {
            continue
          }

          otherNewWords = apply(newWord, combined, rules)
          newWordCount = otherNewWords.length
          suboffset = -1

          while (++suboffset < newWordCount) {
            add(otherNewWords[suboffset])
          }
        }
      }
    }
  }

  // Add `rules` for `word` to the table.
  function add (word, rules) {
    // Some dictionaries will list the same word multiple times with different
    // rule sets.
    var curr = (own.call(dict, word) && dict[word]) || []
    dict[word] = curr.concat(rules || [])
  }
}

},{"./apply.js":12}],11:[function(require,module,exports){
'use strict'

var trim = require('./trim.js')
var parse = require('./rule-codes.js')

module.exports = affix

// Rule types.
var onlyInCompoundType = 'ONLYINCOMPOUND'
var compoundRuleType = 'COMPOUNDRULE'
var compoundInType = 'COMPOUNDMIN'
var wordCharsType = 'WORDCHARS'
var keepCaseFlag = 'KEEPCASE'
var noSuggestType = 'NOSUGGEST'
var iconvType = 'ICONV'
var oconvType = 'OCONV'
var flagType = 'FLAG'
var prefixType = 'PFX'
var suffixType = 'SFX'
var replaceType = 'REP'
var tryType = 'TRY'
var keyType = 'KEY'

// Constants.
var combineable = 'Y'

// Relative frequencies of letters in the English language.
var alphabet = 'etaoinshrdlcumwfgypbvkjxqz'.split('')

// Expressions.
var whiteSpaceExpression = /\s+/

// Characters.
var linefeed = '\n'
var dollarSign = '$'
var caret = '^'
var slash = '/'
var dot = '.'
var digit0 = '0'
var numberSign = '#'.charCodeAt(0)

// Defaults.
var defaultCompoundInType = 3

var defaultKeyboardLayout = [
  'qwertzuop',
  'yxcvbnm',
  'qaw',
  'say',
  'wse',
  'dsx',
  'sy',
  'edr',
  'fdc',
  'dx',
  'rft',
  'gfv',
  'fc',
  'tgz',
  'hgb',
  'gv',
  'zhu',
  'jhn',
  'hb',
  'uji',
  'kjm',
  'jn',
  'iko',
  'lkm'
]

// Parse an affix file.
// eslint-disable-next-line complexity
function affix (aff) {
  var rules = {}
  var replacementTable = []
  var conversion = { in: [], out: [] }
  var compoundRuleCodes = {}
  var lines = []
  var flags = {}
  var compoundRules = []
  var index
  var length
  var parts
  var line
  var ruleType
  var entries
  var count
  var remove
  var add
  var source
  var entry
  var ruleLength
  var position
  var rule
  var last
  var value
  var offset
  var character

  flags[keyType] = []

  // Process the affix buffer into a list of applicable lines.
  aff = aff.toString('utf8')
  index = aff.indexOf(linefeed)
  last = 0

  while (index !== -1) {
    pushLine(aff.slice(last, index))
    last = index + 1
    index = aff.indexOf(linefeed, last)
  }

  pushLine(aff.slice(last))

  // Process each line.
  index = -1
  length = lines.length

  while (++index < length) {
    line = lines[index]
    parts = line.split(whiteSpaceExpression)
    ruleType = parts[0]

    if (ruleType === replaceType) {
      count = index + parseInt(parts[1], 10)

      while (++index <= count) {
        parts = lines[index].split(whiteSpaceExpression)
        replacementTable.push([parts[1], parts[2]])
      }

      index = count
    } else if (ruleType === iconvType || ruleType === oconvType) {
      entry = conversion[ruleType === iconvType ? 'in' : 'out']
      count = index + parseInt(parts[1], 10)

      while (++index <= count) {
        parts = lines[index].split(whiteSpaceExpression)

        entry.push([new RegExp(parts[1], 'g'), parts[2]])
      }

      index = count
    } else if (ruleType === compoundRuleType) {
      count = index + parseInt(parts[1], 10)

      while (++index <= count) {
        rule = lines[index].split(whiteSpaceExpression)[1]
        ruleLength = rule.length
        position = -1

        compoundRules.push(rule)

        while (++position < ruleLength) {
          compoundRuleCodes[rule.charAt(position)] = []
        }
      }

      index = count
    } else if (ruleType === prefixType || ruleType === suffixType) {
      count = index + parseInt(parts[3], 10)
      entries = []

      rule = {
        type: ruleType,
        combineable: parts[2] === combineable,
        entries: entries
      }

      rules[parts[1]] = rule

      while (++index <= count) {
        parts = lines[index].split(whiteSpaceExpression)
        remove = parts[2]
        add = parts[3].split(slash)
        source = parts[4]

        entry = {
          add: '',
          remove: '',
          match: '',
          continuation: parse(flags, add[1])
        }

        if (add && add[0] !== digit0) {
          entry.add = add[0]
        }

        try {
          if (remove !== digit0) {
            entry.remove = ruleType === suffixType ? end(remove) : remove
          }

          if (source && source !== dot) {
            entry.match = (ruleType === suffixType ? end : start)(source)
          }
        } catch (error) {
          // Ignore invalid regex patterns.
          entry = null
        }

        if (entry) {
          entries.push(entry)
        }
      }

      index = count
    } else if (ruleType === tryType) {
      source = parts[1]
      count = source.length
      offset = -1
      value = []

      while (++offset < count) {
        character = source.charAt(offset)

        if (character.toLowerCase() === character) {
          value.push(character)
        }
      }

      // Some dictionaries may forget a character.  Notably the enUS forgets
      // the `j`, `x`, and `y`.
      offset = -1
      count = alphabet.length

      while (++offset < count) {
        character = alphabet[offset]

        if (source.indexOf(character) === -1) {
          value.push(character)
        }
      }

      flags[ruleType] = value
    } else if (ruleType === keyType) {
      flags[ruleType] = flags[ruleType].concat(parts[1].split('|'))
    } else if (ruleType === compoundInType) {
      flags[ruleType] = Number(parts[1])
    } else if (ruleType === onlyInCompoundType) {
      // If we add this ONLYINCOMPOUND flag to `compoundRuleCodes`, then
      // `parseDic` will do the work of saving the list of words that are
      // compound-only.
      flags[ruleType] = parts[1]
      compoundRuleCodes[parts[1]] = []
    } else if (
      ruleType === keepCaseFlag ||
      ruleType === wordCharsType ||
      ruleType === flagType ||
      ruleType === noSuggestType
    ) {
      flags[ruleType] = parts[1]
    } else {
      // Default handling.  Set them for now.
      flags[ruleType] = parts[1]
    }
  }

  // Default for `COMPOUNDMIN` is `3`.  See man 4 hunspell.
  if (isNaN(flags[compoundInType])) {
    flags[compoundInType] = defaultCompoundInType
  }

  if (flags[keyType].length === 0) {
    flags[keyType] = defaultKeyboardLayout
  }

  /* istanbul ignore if - Dictionaries seem to always have this. */
  if (!flags[tryType]) {
    flags[tryType] = alphabet.concat()
  }

  if (!flags[keepCaseFlag]) {
    flags[keepCaseFlag] = false
  }

  return {
    compoundRuleCodes: compoundRuleCodes,
    replacementTable: replacementTable,
    conversion: conversion,
    compoundRules: compoundRules,
    rules: rules,
    flags: flags
  }

  function pushLine (line) {
    line = trim(line)

    // Hash can be a valid flag, so we only discard line that starts with it.
    if (line && line.charCodeAt(0) !== numberSign) {
      lines.push(line)
    }
  }
}

// Wrap the `source` of an expression-like string so that it matches only at
// the end of a value.
function end (source) {
  return new RegExp(source + dollarSign)
}

// Wrap the `source` of an expression-like string so that it matches only at
// the start of a value.
function start (source) {
  return new RegExp(caret + source)
}

},{"./rule-codes.js":19,"./trim.js":20}],12:[function(require,module,exports){
'use strict'

module.exports = apply

// Apply a rule.
function apply (value, rule, rules) {
  var entries = rule.entries
  var words = []
  var index = -1
  var length = entries.length
  var entry
  var next
  var continuationRule
  var continuation
  var position
  var count

  while (++index < length) {
    entry = entries[index]

    if (!entry.match || value.match(entry.match)) {
      next = value

      if (entry.remove) {
        next = next.replace(entry.remove, '')
      }

      if (rule.type === 'SFX') {
        next += entry.add
      } else {
        next = entry.add + next
      }

      words.push(next)

      continuation = entry.continuation

      if (continuation && continuation.length !== 0) {
        position = -1
        count = continuation.length

        while (++position < count) {
          continuationRule = rules[continuation[position]]

          if (continuationRule) {
            words = words.concat(apply(next, continuationRule, rules))
          }
        }
      }
    }
  }

  return words
}

},{}],13:[function(require,module,exports){
'use strict'

module.exports = casing

// Get the casing of `value`.
function casing (value) {
  var head = exact(value.charAt(0))
  var rest = value.slice(1)

  if (!rest) {
    return head
  }

  rest = exact(rest)

  if (head === rest) {
    return head
  }

  if (head === 'u' && rest === 'l') {
    return 's'
  }

  return null
}

function exact (value) {
  if (value.toLowerCase() === value) {
    return 'l'
  }

  return value.toUpperCase() === value ? 'u' : null
}

},{}],14:[function(require,module,exports){
'use strict'

var trim = require('./trim.js')
var parseCodes = require('./rule-codes.js')
var add = require('./add.js')

module.exports = parse

// Expressions.
var whiteSpaceExpression = /\s/g

// Constants.
var UTF8 = 'utf8'
var linefeed = '\n'
var numberSign = '#'
var slash = '/'
var backslash = '\\'
var tab = '\t'.charCodeAt(0)

// Parse a dictionary.
function parse (buf, options, dict) {
  var index
  var last
  var value

  // Parse as lines.
  value = buf.toString(UTF8)
  last = value.indexOf(linefeed) + 1
  index = value.indexOf(linefeed, last)

  while (index !== -1) {
    if (value.charCodeAt(last) !== tab) {
      parseLine(value.slice(last, index), options, dict)
    }

    last = index + 1
    index = value.indexOf(linefeed, last)
  }

  parseLine(value.slice(last), options, dict)
}

// Parse a line in dictionary.
function parseLine (line, options, dict) {
  var word
  var codes
  var result
  var hashOffset
  var slashOffset

  // Find offsets.
  slashOffset = line.indexOf(slash)
  while (slashOffset !== -1 && line.charAt(slashOffset - 1) === backslash) {
    line = line.slice(0, slashOffset - 1) + line.slice(slashOffset)
    slashOffset = line.indexOf(slash, slashOffset)
  }

  hashOffset = line.indexOf(numberSign)

  // Handle hash and slash offsets.  Note that hash can be a valid flag, so we
  // should not just discard all string after it.
  if (hashOffset >= 0) {
    if (slashOffset >= 0 && slashOffset < hashOffset) {
      word = line.slice(0, slashOffset)
      whiteSpaceExpression.lastIndex = slashOffset + 1
      result = whiteSpaceExpression.exec(line)
      codes = line.slice(slashOffset + 1, result ? result.index : undefined)
    } else {
      word = line.slice(0, hashOffset)
    }
  } else if (slashOffset >= 0) {
    word = line.slice(0, slashOffset)
    codes = line.slice(slashOffset + 1)
  } else {
    word = line
  }

  word = trim(word)
  if (word) {
    codes = parseCodes(options.flags, codes && trim(codes))
    add(dict, word, codes, options)
  }
}

},{"./add.js":10,"./rule-codes.js":19,"./trim.js":20}],15:[function(require,module,exports){
'use strict'

var flag = require('./flag.js')

module.exports = exact

var own = {}.hasOwnProperty

// Check spelling of `value`, exactly.
function exact (context, value) {
  var data = context.data
  var flags = context.flags
  var codes = own.call(data, value) ? data[value] : null
  var compound
  var index
  var length

  if (codes) {
    return !flag(flags, 'ONLYINCOMPOUND', codes)
  }

  compound = context.compoundRules
  length = compound.length
  index = -1

  // Check if this might be a compound word.
  if (value.length >= flags.COMPOUNDMIN) {
    while (++index < length) {
      if (value.match(compound[index])) {
        return true
      }
    }
  }

  return false
}

},{"./flag.js":16}],16:[function(require,module,exports){
'use strict'

module.exports = flag

var own = {}.hasOwnProperty

// Check whether a word has a flag.
function flag (values, value, flags) {
  return flags && own.call(values, value) && flags.indexOf(values[value]) !== -1
}

},{}],17:[function(require,module,exports){
'use strict'

var normalize = require('./normalize.js')
var trim = require('./trim.js')
var exact = require('./exact.js')
var flag = require('./flag.js')

module.exports = form

// Find a known form of `value`.
function form (context, value, all) {
  var dict = context.data
  var flags = context.flags
  var alternative

  value = trim(value)

  if (!value) {
    return null
  }

  value = normalize(value, context.conversion.in)

  if (exact(context, value)) {
    if (!all && flag(flags, 'FORBIDDENWORD', dict[value])) {
      return null
    }

    return value
  }

  // Try sentence-case if the value is upper-case.
  if (value.toUpperCase() === value) {
    alternative = value.charAt(0) + value.slice(1).toLowerCase()

    if (ignore(flags, dict[alternative], all)) {
      return null
    }

    if (exact(context, alternative)) {
      return alternative
    }
  }

  // Try lower-case.
  alternative = value.toLowerCase()

  if (alternative !== value) {
    if (ignore(flags, dict[alternative], all)) {
      return null
    }

    if (exact(context, alternative)) {
      return alternative
    }
  }

  return null
}

function ignore (flags, dict, all) {
  return (
    flag(flags, 'KEEPCASE', dict) || all || flag(flags, 'FORBIDDENWORD', dict)
  )
}

},{"./exact.js":15,"./flag.js":16,"./normalize.js":18,"./trim.js":20}],18:[function(require,module,exports){
'use strict'

module.exports = normalize

// Normalize `value` with patterns.
function normalize (value, patterns) {
  var length = patterns.length
  var index = -1
  var pattern

  while (++index < length) {
    pattern = patterns[index]
    value = value.replace(pattern[0], pattern[1])
  }

  return value
}

},{}],19:[function(require,module,exports){
'use strict'

module.exports = ruleCodes

// Parse rule codes.
function ruleCodes (flags, value) {
  var flag = flags.FLAG
  var result = []
  var length
  var index

  if (!value) {
    return result
  }

  if (flag === 'long') {
    index = 0
    length = value.length

    while (index < length) {
      result.push(value.substr(index, 2))

      index += 2
    }

    return result
  }

  return value.split(flag === 'num' ? ',' : '')
}

},{}],20:[function(require,module,exports){
'use strict'

var re = /^\s*|\s*$/g

module.exports = trim

function trim (value) {
  return value.replace(re, '')
}

},{}],21:[function(require,module,exports){
'use strict'

module.exports = wordCharacters

// Get the word characters defined in affix.
function wordCharacters () {
  return this.flags.WORDCHARS || null
}

},{}],22:[function(require,module,exports){
// custom promisifed async forEach function taken from p-iteration
async function forEach (array, callback, thisArg) {
  const promiseArray = []
  for (let i = 0; i < array.length; i++) {
    if (i in array) {
      const p = Promise.resolve(array[i]).then((currentValue) => {
        return callback.call(thisArg || this, currentValue, i, array)
      })
      promiseArray.push(p)
    }
  }
  await Promise.all(promiseArray)
}

// read a file, the firefox extension way
function readFile (path) {
  return new Promise((resolve, reject) => {
    fetch(path, { mode: 'same-origin' })
      .then(function (res) {
        return res.blob()
      })
      .then(function (blob) {
        const reader = new FileReader()

        reader.addEventListener('loadend', function () {
          resolve(this.result)
        })

        reader.readAsText(blob)
      })
      .catch(error => {
        resolve({ error: error })
      })
  })
}

// return misspelt words and suggestions
function checkSpelling (spell, content) {
  const spelling = {
    cleanedContent: [],
    misspeltWords: [],
    suggestions: {}
  }

  // split string by spaces and strip out punctuation that does not form part of the word itself
  // then remove any strings that are numbers or less than 1 char in length
  spelling.cleanedContent = content.split(/(?:\s)/)
    .reduce((acc, string) => acc.concat([string.replace(/(\B\W|\W\B)/gm, '')]), [])
    .reduce((acc, string) => {
      return string.length > 1 && isNaN(string) && !string.includes('@')
        ? acc.concat([string])
        : acc
    }, [])

  console.log('cleaned content', spelling.cleanedContent)

  for (const word of spelling.cleanedContent) {
    if (!spell.correct(word)) {
      spelling.suggestions[word] = spell.suggest(word)
      spelling.misspeltWords.push(word)
    }
  }

  console.log('misspelt words', spelling.misspeltWords)

  return spelling
}

// sexy es6 debounce with spread operator
function debounce (callback, wait) {
  let timeout
  return (...args) => {
    const context = this
    clearTimeout(timeout)
    timeout = setTimeout(() => callback.apply(context, args), wait)
  }
}

// get text from a given node
function getText (node) {
  if (node.nodeName === 'INPUT' || node.nodeName === 'TEXTAREA') {
    return node.value
  } else {
    return node.innerText
  }
}

// get local dictionary files according to supported languages
async function loadDictionariesAndPrefs (languages) {
  const dicts = []
  let prefs = []
  return forEach(languages, async (lang) => {
    prefs.push(lang)
    const dic = await readFile(browser.runtime.getURL(`./dictionaries/${lang}.dic`))
    const aff = await readFile(browser.runtime.getURL(`./dictionaries/${lang}.aff`))
    if (!dic.error && !aff.error) {
      dicts.push({ languageCode: lang, dic: dic, aff: aff })
    } else {
      // prevent race condition when reading files changing the preferred language order
      prefs = prefs.filter((value) => value !== lang)
    }
  }).then(function () {
    return { dicts, prefs }
  }).catch(function (err) {
    console.log(err)
  })
}

module.exports = {
  checkSpelling,
  debounce,
  getText,
  loadDictionariesAndPrefs
}

},{}]},{},[1]);
