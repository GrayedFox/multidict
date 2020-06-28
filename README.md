# multidict

is an open source multilingual language detecting spellchecker.

Supported languages are based on the dictionaries used for spell checking in Chrome, Firefox,
LibreOffice, OpenOffice, and many more apps that rely on the Hunspell spell checker.

## Table of Contents

- [Feature List](#feature-list)
- [Supported Languages](#supported-languages)
- [Usage](#usage)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
  - [Enabling Multiple Language Spellchecking](#enabling-multiple-language-spell-checking)
  - [I want a different lightsaber (highlight colour)!](#i-want-a-different-lightsaber)
  - [Disabling the built in spellchecker](#disabling-the-built-in-spellchecker)
  - [Limiting Word Suggestions](#limiting-word-suggestions)
  - [Spell Checking Language Preference](#spell-checking-language-preference)
- [FAQ](#frequently-asked-questions)
  - [Where are the suggestions?](#where-are-the-suggestions)
- [Privacy Policy](#privacy-policy)
- [Contact Details](#contact-details)
- [Credits](#credits)

## Feature List

Multidict ships with these nifty features:

- choose your own lightsaber! Highlights will appear in whatever colour you think most fits your
  personality/mood/unicorn mojo
- personal dictionary shared across all languages: if shizzle is a word for you in English, one
  assumes you probably annoy your friends with it in German too (my nizzle)
- easily view and manage all custom words: you can view any word added to your personal dictionary
  in the Multidict sidebar any time you please
- proximity based suggestions! suggestions are ordered based on how "close" they are to the misspelt
  word
- get inline spelling suggestions and navigate through them with alt+shift up or alt+shift down
- cancel choosing a spelling suggestion by navigating away with alt+shift left or alt+shift right
- easily add or remove a word from your personal dictionary using the sidebar, a context menu, or
  by pressing alt+shift+a (for add) or alt+shift+d (for delete)
- never have to switch between languages again! All text areas will detect whatever language you
  are writing in and apply spell checking based on your preferred language list
- synced storage means your preferences and personal dictionary persist across all of your devices
- word suggestions will match the font and style of whatever text area you are editing, because
  having 7 different fonts and sizes on any given website is already criminal enough

![Multidict in action!](media/demo/demo-multidict.gif?raw=true "Multidict")

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

You don't need to configure anything if you don't want to: Multidict will detect whatever languages
and dictionaries you have already added via the addons store and spell check content based on those
languages, as long as you have [added those languages as a preferred display language](#enabling-multiple-language-spell-checking).

If you're like me and prefer to use your keyboard over your mouse, check out the shortcuts section.

### Keyboard Shortcuts

All of the keyboard shortcuts require alt and shift to be pressed. This is to prevent accidental
word insertions or dictionary edits. Some of these keyboard shortcuts are configurable, others may
become so in the future (let's see!). Defaults:

- ALT+SHIFT+A: add a word to your personal dictionary
- ALT+SHIFT+D: delete a word from your personal dictionary
- ALT+SHIFT+UP: rotate the word carousel up
- ALT+SHIFT+DOWN: rotate the word carousel down!
- ALT+SHIFT+LEFT: close the carousel without choosing a word suggestion
- ALT+SHIFT+RIGHT: same behaviour as left, this will close the suggestions list without choosing one

> Note: you can, if you so choose, change the shortcuts for adding and removing words from your
personal dictionary from the main settings of the addon:

1. Click the Firefox burger menu button
2. Click `Addons` and then select `Extensions` (if the extensions view is not already open)
3. To the right of Manage your Extensions is a cogwheel/settings icon. Click is and choose
  `Manage Extension Shortcuts`
4. You should now see Multidict and any other addon shortcut options listed
5. Click inside the text box that lists the current short cut combination to start recording the
   shortcut combination you would like to use.

### Enabling Multiple Language Spell Checking

To enable spell checking for multiple languages:

1. Open up Firefox and type `about:preferences` into the URL bar
2. Scroll down the page and click the `Choose` button next to "Choose your preferred language for
   displaying pages"
3. Add your desired languages by choosing the "Select a language to add" checkbox

### I Want A Different Lightsaber!

To change the highlights used for marking misspelt words:

1. Click the Multidict icon located at the top right of the browser window nearby all those other
   pesky extensions
2. Click the `Choose highlight colour` button
3. Choose your colour.

Note: you will also get a preview of what the highlight colour looks like in any text area that
already has misspelt words.

### Disabling The Built In Spellchecker

The spell checking from this extension is only applied to text areas so at the moment Gmail and
other rich text editors will still use the built in spell checking that comes bundled with the
browser. In order not to get overlaps between Mulidict and Firefox for text areas, you can opt into
disabling the built in spell checking for text areas in the Multidict settings panel:

1. Click the Multidict icon located at the top right of the browser window nearby all those other
   pesky extensions
2. Click the `Options` menu
3. Make sure `Disable duplicate spell checking` is checked

You don't need to restart your browser but you will need to refresh any already open pages to
disable the browsers built in spellchecking for text areas.

### Limiting Word Suggestions

The default maximum number of suggestions shown for any one word is 4. You can change this value in
the Options sub-menu in the Multidict settings panel:

1. Click the Multidict icon located at the top right of the browser window nearby all those other
   pesky extensions
2. Click the `Options` menu
3. Use the slider and drag it between 0 or 10+ (unlimited) suggestions.

> Note that setting the suggestions limit to 0 will disable suggestions entirely.

### Spell Checking Language Preference

The extension will detect which language is being used inside text areas on the page and try to
match that to one of your preferred languages. If it can't find a match or cannot reliably detect
the language it will default to spell checking in your primary preferred language.

Let's take a look at a slightly complex example and go through it step by step:

1. You add the Australian English (en-au), American English (en-us), and standard German (de-de)
   languages to your Firefox preferred languages list via Firefox preferences pane in that order

2. You write the sentence 'Ich leibe mein Leben' inside a textarea.

- multidict will detect the language as German (de) and attempt to match it like so: de-au
- no match is found, so the next language in your preferred language list is checked: de-us
- no match is found, so the next language in your preferred language list is checked: de-de
- a match with a preferred language is found which matches the detected content language, so
  Multidict will use the German dictionary to spell check and offer suggestions for `leibe`
  (which should be spelt `liebe`)

3. You write the text "Such beautiful colours! Colorful days are great!" as the body of the email

- Multidict will detect the language as English (en) and attempt to match it like so: en-au
- a match with a preferred language is found which matches the subject text field language
- because Australian English has a higher preference than American English according to your
  preferences, Multidict will use Australian English to spell check, and offer suggestions for
  `Colorful` (which is misspelt in Australian English and missing a "u")

This way you can use multiple dictionaries on the same page/tab without changing any preferences or
using any hotkeys. It is especially useful if you are used to rapidly switching between contexts and
languages in a work setting or if you are simply doing your best to learn a new language, as I am.

> Note: your first specified language is also your default language and is used when no matches
can be found. Thus if you are editing content in French and (for whatever reason) French is not in
your supported languages list, in the above example, spell checking would be done against Australian
English.

## Frequently Asked Questions

Currently just one, watch this space.

### Where Are The Suggestions?

The suggestions list for any given word is hidden from the user. While this might seem like an odd
choice for a spellchecker plugin, there are good reasons for it: one is that cycling each suggestion
is actually faster than opening a list, scanning it for the right word, and then selecting that word
with your mouse. The other is because each suggestion is ordered based on it's proximity to the
misspelt word. That means that by cycling **UP** through the suggestions, the user will naturally
cycle through words that are more likely to be what the user intended with as few as one or two
key presses.

To illustrate let's take a step-by-step look at what happens when a user makes a common misspelling
and inputs "releived":

1. The user sees the word "releived" highlighted
2. Multidict creates a list with the following words, in ascending order from bottom to top:

   - relived  (3rd and final suggestion, user sees this if pressing alt+shift+up 3 times)
   - relieved (2nd suggestion, user sees this if pressing alt+shift+up 2 times)
   - received (1st suggestion, user will immediately see this upon pressing alt+shift+up 1 times)

Multidict doesn't always get things right: sometimes the suggestion you want will not be in 1st
place, but it will rarely, if ever, be at the last place (and especially when there is a longer list
of suggestions).

## Privacy Policy

_No information is_ ___ever___ _collected by this addon or sent to any 3rd party._

This extension doesn't track, spy, collect, or record information about you or your browser or your
"session" in any way, shape, or form. Everything you write - from the language you write in to the
words and phrases you employ - is between you and whoever else you are writing to (and quite
possibly the website/service/product you are using).

This extension uses the native Firefox [detect language][8] feature which is a JavaScript wrapper
around the Compact Language Detector software [CLD2][9] and I cannot say for sure that when calling
this method, Firefox isn't collecting data about the usage of this part of their extension API.

I can say that there doesn't seem to be any requests being made inside the Network tab of the
developer tools when calling this function and that Mozilla has a very to-the-point, down-to-earth
[privacy policy][10] which details their philosophy and approach to data collection which clearly
states that _"Mozilla doesn’t sell data about you, and we don’t buy data about you."_

Firefox is open source software which makes them a damn sight more trustworthy and accountable than
most other companies (and certainly most other browsers) out in the wild. If you have the skills and
time you could also poke around their code base yourself just to make absolutely sure they are only
collecting information about your browsing habits in the way the say they do - in fact they
_"...make our documentation public so that anyone can verify what we say is true, tell us if we need
to improve, and have confidence that we aren’t hiding anything."_

It should be noted that while this extension doesn't collect any data, it **doesn't prevent websites
like Facebook, or malicious actors, from collecting, selling, and storing such information.**

There's a good chance that what you write is being tracked in some way by the website or service you
are using and there may be legitimate use cases for this. If privacy is a top concern of yours then
don't use products from companies you don't trust: if you wouldn't trust some random stranger with
your address, real time location, email address, age, date of birth, and other "information that
said stranger finds useful" (and especially if they said "oh no I promise it's only for me, and my
friends, and the friends of my friends") it makes absolutely no sense to give your information to a
company run by shady people you've never met that profit off of using and sharing your data with
their friends and the friends of their friends so they can target you in some way.

## Contact Details

For bug reports and feature requests use the GitHub issue tracker, to enquire about something else
send an email to [che.fisher+mutidict@gmail.com][12]

## Credits

- Dictionaries by [Hunspell][0] and available for download [here][1]
- Icons by [SmashIcons][2], taken from [Flaticon.com][3]
- Spellchecking powered by [NSpell][4], made by Titus Wormer, the brains behind the [retext][5] NLP
- The [HighlightWithinTextarea][7] jQuery plugin by Will Boyd served as the base of a much earlier
  version of the highlighter.js file. It has since been completely re-written from scratch, but
  credit where credit is due: cheers Mr. Boyd!
- Async forEach helper function taken from Antonio V's [p-iteration][6] module
- Language detection thanks to Dick Sites and the kick-ass [CLD2][9] (Compact Language Detector 2)
  software
- Word suggestions carousel made possible by the good graces of David DeSandro, who wrote an
  excellent tutorial called [Introduction to CSS 3D transforms][11]. Give it a read, it's awesome.
- Mozilla and all her contributors
- All of you, duh!

Thank you for using this software. Please feel free to leave a bug report or feedback via the GitHub
[issue tracker][13] or send me an email if you prefer (contact details below) :)

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
 [13]: https://github.com/GrayedFox/multidict/issues
