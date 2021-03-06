module.exports = {
  env: {
    browser: true,
    es2020: true,
    webextensions: true,
    mocha: true
  },
  extends: ['eslint:recommended', 'standard'],
  globals: {},
  parserOptions: {
    sourceType: 'module'
  },
  ignorePatterns: ['dist/**'],
  rules: {}
}
