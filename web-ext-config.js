module.exports = {
  build: {
    overwriteDest: true
  },
  run: {
    firefoxProfile: 'addons',
    keepProfileChanges: true,
    startUrl: [
      'file:///home/grayedfox/github/multi-dict/src/test-page.html',
      'about:debugging',
      'about:preferences'
    ]
  },
  ignoreFiles: [
    'package-lock.json',
    'src/**'
  ]
}
