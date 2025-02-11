#!/bin/sh
cd /usr/share/nginx/html

echo "Substituting base-href in index.html"

SEARCH_BASE_HREF='<base href=".*?" ?\/>'
BASE_HREF="<base href=\"$BASE_URL\" \/>"

echo "Checksum before: ";
cksum index.html
sed -i --regexp-extended "s|$SEARCH_BASE_HREF|$BASE_HREF|" index.html
echo "Checksum after: ";
cksum index.html

echo "Substituting api urls in main-es*.js"; 

SEARCH_API_URL='"\{API_URL\}"'
REPLACE_API_URL="\"$API_URL\""

echo "Checksum before: ";
find . -name 'main-es*.js' -exec cksum {} \;

find . -name 'main-es*.js' -exec sed -i --regexp-extended "s|$SEARCH_API_URL|$REPLACE_API_URL|g" {} \;

echo "Checksum after: ";
find . -name 'main-es*.js' -exec cksum {} \;
