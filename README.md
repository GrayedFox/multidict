# Multi Dict

Use multiple languages when spell checking inside Firefox.

Supported languages are based on the dictionaries used for spell checking in Chrome, Firefox,
LibreOffice, OpenOffice, and many more apps that rely on the Hunspell spell checker.

## Usage

### Disabling Built In Spellchecker

The spell checking part of this extension is essentially a JavaScript only version of Hunspell, the
exact spell checker used by Firefox in the first place, and it employs the same default
dictionaries. So you can trust the add-on to do all the spell checking for you and behave the way
you expect it would.

To prevent double reports and conflicts please disable the built-in spell checker:

1. open up Firefox and type `about:preferences` into the URL bar
2. scroll down the page and uncheck the "Check your spelling as you type" checkbox

### Enabling Multi Language Spell Checking

To enable spell checking for multiple languages:

1. open up Firefox and type `about:preferences` into the URL bar
2. scroll down the page and click the `Choose` button next to
   "Choose your preferred language for displaying pages"
3. add your desired languages by choosing the "Select a language to add" checkbox

### How It Works: Spell Checking Language Preference

The extension will detect which language is being used inside editable elements on the page and try
to match that to one of your supported languages. If it can't find a match or cannot reliably detect
the language it will default to your primary preferred language.

Let's take a look at a complex example and go through it step by step...

1. you add the Australian English (en-au), American English (en-us), and standard German (de-de)
   languages to your Firefox preferred languages list via Firefox preferences pane in that order

2. you write the sentence 'Ich liebe mein leben' as the subject of an email
   - Multi Dict will detect the language as German (de) and attempt to match it like so: de-au
   - no match is found, so the next language in your preferred language list is checked: de-us
   - no match is found, so the next language in your preferred language list is checked: de-de
   - a match with a preferred language is found which matches the subject text field language, so
     Multi Dict will use the German dictionary to spell check and offer suggestions for `leben`
     (which should be capitalised)

3. you write the text "Such beautiful colours! Colorful days are great!" as the body of the email
   - Multi Dict will detect the language as English (en) and attempt to match it like so: en-au
   - a match with a preferred language is found which matches the subject text field language
   - because Australian English has a higher preference than American English according to your
     preferences, Multi Dict will use Australian English to spell check, and offer suggestions for
     `Colorful` (which is misspelt in Australian English and missing a "u")

This way you can use multiple dictionaries on the same page/tab without changing any preferences or
using any hotkeys. It is especially useful if you are used to composing emails in multiple
languages.


## Supported Languages

- German (de-de)
- American English (en-us)
- Australian English (en-au)
- British English (en-gb)
- French (fr-fr)
- Italian (it-it)
- Polish (pl-pl)
- Romanian (ro-ro)
- Russian (ru-ru)
- Spanish (es-es)

## Credits

- Dictionaries by [Hunspell][0] and available for download [here][1].
- Icons by [SmashIcons][2], taken from [Flaticon.com][3].
- Powered by [NSpell][4], made by Titus Wormer, the brilliant mind behind the [retext][5] NLP.
- Async forEach helper function taken from Antonio V's [p-iteration][6] module

 [0]: https://hunspell.github.io/
 [1]: https://src.chromium.org/viewvc/chrome/trunk/deps/third_party/hunspell_dictionaries/
 [2]: https://www.flaticon.com/authors/smashicons
 [3]: https://www.flaticon.com/
 [4]: https://github.com/wooorm/nspell
 [5]: https://github.com/retextjs/retext
 [6]: https://github.com/toniov/p-iteration
