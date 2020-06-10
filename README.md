# MultiDict

Smart language detection spell checker with configurable word highlights, add/remove shortcuts, and
multiple language support.

Supported languages are based on the dictionaries used for spell checking in Chrome, Firefox,
LibreOffice, OpenOffice, and many more apps that rely on the Hunspell spell checker.

![Language detection! Neat!](media/demo/multi-dict-demo.gif?raw=true "MultiDict")

## Supported Languages

- American English (en-us)
- Australian English (en-au)
- British English (en-gb)
- French (fr-fr)
- German (de-de)
- Italian (it-it)
- Polish (pl-pl)
- Romanian (ro-ro)
- Russian (ru-ru)
- Spanish (es-es)

## Usage

### Should I disable the built in Spellchecker?

The spell checking from this addon is only applied to textareas, so editable divs will still use the
built in spell checking from Firefox. In order not to get overlaps, you can opt into disabling the
built in spell checking for textareas in the settings page of the addon.


### Enabling Multi Language Spell Checking

To enable spell checking for multiple languages:

1. open up Firefox and type `about:preferences` into the URL bar
2. scroll down the page and click the `Choose` button next to
   "Choose your preferred language for displaying pages"
3. add your desired languages by choosing the "Select a language to add" checkbox

### How It Works: Spell Checking Language Preference

The extension will detect which language is being used inside textareas on the page and try to
match that to one of your supported languages. If it can't find a match or cannot reliably detect
the language it will default to your primary preferred language.

Let's take a look at a slightly complex example and go through it step by step:

1. you add the Australian English (en-au), American English (en-us), and standard German (de-de)
   languages to your Firefox preferred languages list via Firefox preferences pane in that order

2. you write the sentence 'Ich leibe mein Leben' inside a textarea
   - MultiDict will detect the language as German (de) and attempt to match it like so: de-au
   - no match is found, so the next language in your preferred language list is checked: de-us
   - no match is found, so the next language in your preferred language list is checked: de-de
   - a match with a preferred language is found which matches the subject text field language, so
     MultiDict will use the German dictionary to spell check and offer suggestions for `leibe`
     (which should be spelt `liebe`)

3. you write the text "Such beautiful colours! Colorful days are great!" as the body of the email
   - MultiDict will detect the language as English (en) and attempt to match it like so: en-au
   - a match with a preferred language is found which matches the subject text field language
   - because Australian English has a higher preference than American English according to your
     preferences, MultiDict will use Australian English to spell check, and offer suggestions for
     `Colorful` (which is misspelt in Australian English and missing a "u")

This way you can use multiple dictionaries on the same page/tab without changing any preferences or
using any hotkeys. It is especially useful if you are used to composing emails in multiple
languages.

> Note that your first specified language is also your default language and is used when no matches
can be found, so if you are editing content in French and (for whatever reason) this is not on your
supported languages list, in the above example, spell checking would be done against Australian
English.

## Privacy

_No information is_ ___ever___ _collected by this add-on or sent to any 3rd party._

It should be noted, however, that the native Firefox [detect language][8] feature is a JavaScript
wrapper around the Compact Language Detector software [CLD2][9] and I cannot say for sure that when
calling this method, Firefox isn't sending data to it's servers.

I can say that there doesn't seem to be any requests being made inside the Network tab of the
developer tools when calling this function and that Mozilla has a very to-the-point, down-to-earth
[privacy policy][10] which details their philosophy and approach to data collection.

Remember, Firefox is open source software, which makes them a damn sight more trustworthy and
accountable than most other companies (and certainly most other browsers) out in the wild, if you
have the skills and time you could also poke around their code base yourself just to make
absolutely sure (or you could proxy all your own web traffic and try to isolate any and all network
traffic coming from Firefox).

## Credits

- Dictionaries by [Hunspell][0] and available for download [here][1]
- Icons by [SmashIcons][2], taken from [Flaticon.com][3]
- Spellchecking powered by [NSpell][4], made by Titus Wormer, the brains behind the [retext][5] NLP
- The [HighlightWithinTextarea][7] jQuery plugin by Will Boyd served as the base of a much earlier
  version of the highlighter.js file. It has since been completely re-written from scratch, but
  credit where credit is due: thankyou Mr. Boyd!
- Async forEach helper function taken from Antonio V's [p-iteration][6] module
- Language detection thanks to Dick Sites and the kick-ass [CLD2][9] (Compact Language Detector 2)
  software
- Word suggestions carousel made possible by the good graces of David DeSandro, who wrote an
  excellent tutorial called [Introduction to CSS 3D transforms][11]. Give it a read, it's awesome.
- Mozilla and all her contributors
- All of you, duh!

Thanks for using this software, feel free to leave a bug report or feedback via the GitHub issue
tracker :)

## Contact Details

For bug reports and feature requests use the GitHub issue tracker, to enquire about something else
send an email to [che.fisher+mutidict@gmail.com][12]

 [0]: https://hunspell.github.io/
 [1]: https://src.chromium.org/viewvc/chrome/trunk/deps/third_party/hunspell_dictionaries/
 [2]: https://www.flaticon.com/authors/smashicons
 [3]: https://www.flaticon.com/
 [4]: https://github.com/wooorm/nspell
 [5]: https://github.com/retextjs/retext
 [6]: https://github.com/toniov/p-iteration
 [7]: https://github.com/lonekorean/highlight-within-textarea
 [8]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/i18n/detectLanguage
 [9]: https://github.com/CLD2Owners/cld2
 [10]: https://www.mozilla.org/en-US/privacy/faq/
 [11]: https://3dtransforms.desandro.com/
 [12]: mailto:che.fisher+multidict@gmail.com
