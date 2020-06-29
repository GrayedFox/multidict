# Developer Docs

## Installing

1. Clone the repository using your preferred cloning mechanism
2. Run `npm install` from the project base directory

## Building

Run `npm run build` to bundle all required files into the `/dist` directory.

## Serving

To test changes inside your browser run `npm run serve`. This will at first build all the files
and then open a Firefox browser with some specific pages that can be used for testing.

## Dependencies

While there are developer dependencies there are no runtime user dependencies. Extensions are always
shipped as a standalone, packaged app.
