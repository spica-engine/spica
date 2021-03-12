#!/usr/bin/env bash

echo "" >CHANGELOG.md

TAGS=($(git tag))

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

    OLDLOGS=$(cat CHANGELOG.md)
    DATE=$(git show -s --format=%cd --date=short $CURRENT)

    CONTENT="## v$NEXT ($DATE)\n\n$COMMITS\n\n$CONTENT"
done

echo -e "$CONTENT" >CHANGELOG.md