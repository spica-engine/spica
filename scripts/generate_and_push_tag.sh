#!/bin/bash

# Ensure there is at least one argument (the version)
if [ -z "$1" ]; then
    echo "Usage: $0 <version> [rc]"
    exit 1
fi

VERSION=$1
RC_OPTION=$2

# Generate the tag based on the version
if [ "$RC_OPTION" == "rc" ]; then
    # If the "rc" option is passed, append "-rc<commit_hash>"
    COMMIT_HASH=$(git rev-parse --short HEAD)
    TAG="${VERSION}-rc-${COMMIT_HASH}"
else
    TAG="${VERSION}"
fi

# Show the latest commit for this tag
LATEST_COMMIT=$(git log -1 --oneline)

echo "Generated Tag: $TAG"
echo "Latest Commit: $LATEST_COMMIT"

# Ask for confirmation
read -p "Do you want to create and push this tag? (y/n): " CONFIRMATION

if [[ "$CONFIRMATION" =~ ^[Yy]$ ]]; then
    # Create and push the tag
    git tag "$TAG"
    git push origin "$TAG"
    echo "Tag $TAG created and pushed."
else
    echo "Tag creation and push cancelled."
fi
