./node_modules/.bin/browserify src/background.js > dist/background.js &&
./node_modules/.bin/browserify src/content.js > dist/content.js &&
cp -r ./src/sidebar -t ./dist/ &&
echo "Bundled files with browserify"
