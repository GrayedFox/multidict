# Developer Docs

## Installing

1. Clone the repository using your preferred cloning mechanism
 - ssh: git@github.com:GrayedFox/multidict.git
 - https: https://github.com/GrayedFox/multidict.git
2. Run `npm install` from the project base directory

## Building

Run `npm run build` to bundle all required files into the `/dist` directory.

## Publishing

Run `npm run publish` to build files using web-ext build and package all source files into
`sourcecode.zip`.

> Note: make sure to bump version numbers inside package.json and manifest.json so that previous
release zip file is not overwritten.

## Serving

To test changes inside your browser run `npm run serve`. This will at first build all the files
and then open a Firefox browser with some specific pages that can be used for testing.

## Dependencies

The app depends on [nspell][0], a JavaScript implementation of Hunspell, to provide spell checking.

The app depends on dictionaries downloaded from [wooorm dictionaries][1] which are themselves a
compilation of different dictionaries from different sources. They each have their own license.

 [0]: https://github.com/wooorm/nspell
 [1]: https://github.com/wooorm/dictionaries/
