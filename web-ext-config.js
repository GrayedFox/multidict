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
      'file:///home/grayedfox/github/multidict/test_page/test-page.html',
      'https://grayedfox.github.io/multidict/',
      'https://grayedfox.github.io/multidict/devdocs/index.html',
      'https://addons.mozilla.org/en-US/firefox/addon/multidict/?src=search',
      'https://stackoverflow.com/questions/62222185/highlight-specific-occurrence-of-word-in-text/62223803#62223803',
      'https://github.com/GrayedFox/multidict/pull/31',
      'https://bugzilla.mozilla.org/show_bug.cgi?id=1644692'
    ]
  },
  ignoreFiles: [
    'package-lock.json',
    'coverage/',
    'coverage/**',
    'docs/',
    'docs/**',
    'src/',
    'src/**',
    'test_page/',
    'test_page/**',
    'tasks/',
    'tasks/**',
    'test/',
    'test/**',
    '_config.yml'
  ]
}
