#!/usr/bin/env bash

# 1. Fetch the latest changes from the origin master branch
git fetch origin master

# 2. Get the latest tag
LATEST_TAG=$(git describe --tags --abbrev=0)

# 3. Get the commits between the latest tag and the latest commit
COMMITS=$(git log "$LATEST_TAG"..HEAD --oneline)

# 4. If there are more than one commit, check the commit messages
if [ $(echo "$COMMITS" | wc -l) -gt 1 ]; then
    NEXT_VERSION_TARGET="patch" # Default is patch
    while IFS= read -r commit; do
        COMMIT_MESSAGE=$(echo "$commit" | cut -d ' ' -f2-)
        # 5. If any commit message starts with "feat", set next version to minor
        if [[ "$COMMIT_MESSAGE" == feat* ]]; then
            NEXT_VERSION_TARGET="minor"
            break
        fi
    done <<<"$COMMITS"

    # 6. Increase the version based on the next version (minor or patch)
    # Get the current version from the latest tag
    VERSION=$(echo "$LATEST_TAG" | sed 's/^v//') # Remove "v" if present
    IFS='.' read -r MAJOR MINOR PATCH <<<"$VERSION"

    if [ "$NEXT_VERSION_TARGET" == "minor" ]; then
        MINOR=$((MINOR + 1))
        PATCH=0 # Reset patch version for minor updates
    else
        PATCH=$((PATCH + 1))
    fi

    # 7. Create the new version tag
    NEW_VERSION="$MAJOR.$MINOR.$PATCH"
    export NEXT_VERSION="$NEW_VERSION" # Export the version for use in the next script
    echo "Next version: $NEW_VERSION"
else
    echo "No commits found between the latest tag and HEAD."
fi
