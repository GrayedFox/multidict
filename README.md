[![dependencies](https://david-dm.org/grayedfox/multidict/status.svg)](https://david-dm.org/grayedfox/multidict)
[![devDependencies](https://david-dm.org/grayedfox/multidict/dev-status.svg)](https://david-dm.org/grayedfox/multidict?type=dev)
![Build and Deploy Docs](https://github.com/GrayedFox/multidict/workflows/Build%20and%20Deploy%20Docs/badge.svg)
![Linting and Unit Tests](https://github.com/GrayedFox/multidict/workflows/Linting%20and%20Unit%20Tests/badge.svg)
[![codecov](https://codecov.io/gh/GrayedFox/multidict/branch/master/graph/badge.svg)](https://codecov.io/gh/GrayedFox/multidict)

Welcome to Multidict, your friendly neighbourhood open source language detecting spellchecker.

Looking for the [User Docs][2]?
Looking for the [JSDOCS][4]?

## Downloading

You can download me directly from the Firefox add-ons store [here][3].

## Installing

1. Clone the repository using your preferred cloning mechanism (ssh or https)
2. Run `npm install` from the project base directory

## Building

`npm run build`

This will bundle all required files into the `/dist` directory.

## Serving

`npm run serve`

This will at first build all the files and then open a Firefox browser with some specific pages that
can be used for testing.

## Publishing

`npm run publish`

This will build files using web-ext build and package all source files into dist/sourcecode.zip

Make sure to bump version numbers inside package.json and manifest.json so that previous release zip
file is not overwritten.

## Updating dictionaries

`npm run update-dicts`

This will download all the latest available dictionaries from [wooorm dictionaries][1].

## Dependencies

The app depends on [nspell][0], a JavaScript implementation of Hunspell, to provide spell checking.

The app depends on dictionaries downloaded from [wooorm dictionaries][1] which are themselves a
compilation of different dictionaries from different sources. They each have their own license.

 [0]: https://github.com/wooorm/nspell
 [1]: https://github.com/wooorm/dictionaries/
 [2]: https://grayedfox.github.io/multidict/
 [3]: https://addons.mozilla.org/en-US/firefox/addon/multidict/?src=search
 [4]: https://grayedfox.github.io/multidict/devdocs/index.html
