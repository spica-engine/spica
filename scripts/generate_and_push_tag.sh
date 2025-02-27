#!/bin/bash

# Ensure there is at least one argument (the version)
if [ -z "$1" ]; then
    echo "Usage: $0 <version> [rc] [-y]"
    exit 1
fi

VERSION=$1
RC_OPTION=$2
AUTO_CONFIRM=false

# Check for -y flag for automatic confirmation
if [[ "$3" == "-y" ]]; then
    AUTO_CONFIRM=true
fi

# Generate the tag based on the version
if [ "$RC_OPTION" == "rc" ]; then
    # If the "rc" option is passed, append "-rc-<commit_hash>"
    COMMIT_HASH=$(git rev-parse --short HEAD)
    TAG="${VERSION}-rc-${COMMIT_HASH}"
else
    TAG="${VERSION}"
fi

# Show the latest commit for this tag
LATEST_COMMIT=$(git log -1 --oneline)

echo "Generated Tag: $TAG"
echo "Latest Commit: $LATEST_COMMIT"

# If -y flag is set, skip the prompt and proceed
if [ "$AUTO_CONFIRM" == true ]; then
    echo "Automatic confirmation enabled. Proceeding with tag creation."
else
    # Ask for confirmation
    read -p "Do you want to create and push this tag? (y/n): " CONFIRMATION
fi

# If confirmation is either 'y' or '-y', proceed with creating and pushing the tag
if [[ "$AUTO_CONFIRM" == true || "$CONFIRMATION" =~ ^[Yy]$ ]]; then
    # Create and push the tag
    git tag "$TAG"
    git push origin "$TAG"
    echo "Tag $TAG created and pushed."
else
    echo "Tag creation and push cancelled."
fi
