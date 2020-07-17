./node_modules/.bin/browserify src/background.js > dist/background.js &&
./node_modules/.bin/browserify src/content.js > dist/content.js &&
./node_modules/.bin/browserify src/sidebar/sidebar.js > dist/sidebar/sidebar.js &&
cp ./src/sidebar/sidebar.html ./src/sidebar/sidebar.css -t ./dist/sidebar/ &&
echo "Bundled files with browserify"
