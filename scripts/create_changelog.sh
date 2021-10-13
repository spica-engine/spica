#!/usr/bin/env bash

# RUN THIS SCRIPT AND CREATE LAST PULL REQUEST BEFORE NEXT RELEASE

VERSION="$1"

if [ ! $VERSION ]; then
    echo "Pass the version as the first argument."
    exit
fi

echo "" >CHANGELOG.md

git tag "${VERSION}"

TAGS=($(git tag --sort=version:refname))

CONTENT=""

for i in "${!TAGS[@]}"; do
    CURRENT=${TAGS[$i]}
    NEXT=${TAGS[$(($i + 1))]}
    if [ ! $NEXT ]; then
        break
    fi

    COMMITS=$(git log --pretty=format:'* '%s'(['%h'](https://github.com/spica-engine/spica/commit/'%h'))' $CURRENT...$NEXT)

    SELECTOR="(\(\#[0-9]*\))"
    COMMITS=$(echo "$COMMITS" | sed -e "s/$SELECTOR//g")

    DATE=$(git show -s --format=%cd --date=short $NEXT)

    CONTENT="## v$NEXT ($DATE)\n\n$COMMITS\n\n$CONTENT"
done

echo -e "$CONTENT" >CHANGELOG.md

git tag -d "${VERSION}" >/dev/null 2>&1

echo "Succesfully completed. Do not forget to push changes."
