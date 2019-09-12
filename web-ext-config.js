module.exports = {
  build: {
    overwriteDest: true
  },
  run: {
    firefoxProfile: 'addons',
    keepProfileChanges: true,
    startUrl: [
      'about:debugging',
      'about:preferences',
      'file:///home/grayedfox/github/multi-dict/src/test-page.html'
    ]
  },
  ignoreFiles: [
    'package-lock.json',
    'src/**'
  ]
}
