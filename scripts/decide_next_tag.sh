#!/usr/bin/env bash

# 1. Fetch the latest changes from the origin master branch
git fetch origin master

# 2. Get the latest tag
LATEST_TAG=$(git describe --tags --abbrev=0)

# 3. Get the commits between the latest tag and the latest commit
COMMITS=$(git log "$LATEST_TAG"..HEAD --oneline || echo "")

# 4. Initialize the next tag target
NEXT_TAG_TARGET=""

# 5. Check if there are relevant commits
while IFS= read -r commit; do
    COMMIT_MESSAGE=$(echo "$commit" | cut -d ' ' -f2-)
    if [[ "$COMMIT_MESSAGE" == ci* || 
          "$COMMIT_MESSAGE" == chore* || 
          "$COMMIT_MESSAGE" == docs* || 
          "$COMMIT_MESSAGE" == refactor* || 
          "$COMMIT_MESSAGE" == test* || 
          "$COMMIT_MESSAGE" == build* || 
          "$COMMIT_MESSAGE" == style* ]]; then
        continue
    fi
    
    if [[ "$COMMIT_MESSAGE" == feat* || "$COMMIT_MESSAGE" == deprecate* ]]; then
        NEXT_TAG_TARGET="minor"
        break
    elif [[ "$COMMIT_MESSAGE" == fix* || "$COMMIT_MESSAGE" == perf* ]]; then
        NEXT_TAG_TARGET="patch"
    fi
done <<<"$COMMITS"

# 6. If a relevant commit was found, generate the next tag
if [ -n "$NEXT_TAG_TARGET" ]; then
    LATEST_VERSION=$(echo "$LATEST_TAG" | sed 's/^v//') # Remove "v" if present
    IFS='.' read -r MAJOR MINOR PATCH <<<"$LATEST_VERSION"

    if [ "$NEXT_TAG_TARGET" == "minor" ]; then
        MINOR=$((MINOR + 1))
        PATCH=0 # Reset patch version for minor updates
    else
        PATCH=$((PATCH + 1))
    fi

    # 7. Create the new version tag
    NEW_TAG="$MAJOR.$MINOR.$PATCH"
    export NEXT_TAG="$NEW_TAG" # Export the version for use in the next script
    echo "Next tag: $NEXT_TAG"
else
    echo "No valuable commit was found to bump the tag."
fi
