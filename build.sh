./node_modules/.bin/browserify src/background.js > dist/background.js &&
./node_modules/.bin/browserify src/content.js > dist/content.js &&
echo "Bundled files with browserify"
