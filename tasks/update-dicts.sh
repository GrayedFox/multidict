LANGARR=("en" "en-AU" "en-GB" "fr" "de" "pl" "ro" "ru" "es")

for i in "${LANGARR[@]}"
do
  NAME=$i
  if [ ${#i} -eq 2 ]; then
    NAME="$NAME-${NAME}"
  fi
  NAME=${NAME,,}
  curl -o "dictionaries/$NAME.dic" "https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/$i/index.dic"
  curl -o "dictionaries/$NAME.aff" "https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/$i/index.aff"
  curl -o "dictionaries/$NAME-license" "https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/$i/license"
done

echo "Downloaded dictionaries and licenses from https://github.com/wooorm/dictionaries/"
echo "Please check all files downloaded successfully: these messages do not indicate success"
