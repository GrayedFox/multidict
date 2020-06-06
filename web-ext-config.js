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
      'file:///home/grayedfox/github/multi-dict/test_page/test-page.html',
      'file:///home/grayedfox/github/multi-dict/test_page/test-page.html'
    ]
  },
  ignoreFiles: [
    'package-lock.json',
    'src/**'
  ]
}
