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
      'file:///home/grayedfox/github/multi-dict/test_page/test-page.html',
      'https://stackoverflow.com/questions/62222185/highlight-specific-occurrence-of-word-in-text/62223803#62223803',
      'https://github.com/GrayedFox/multi-dict/pull/31',
      'https://bugzilla.mozilla.org/show_bug.cgi?id=1644692'
    ]
  },
  ignoreFiles: [
    'package-lock.json',
    'src/**'
  ]
}
