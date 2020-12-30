#!/bin/bash
set -e
source "./prepare.sh"

if [ $COMMAND == "ls" ]; then
    echo $(cat "$TARGET_WD/package.json")
elif [ $COMMAND == "install" ]; then
    echo $NAME
    npm install -C "$TARGET_WD" --cache="/tmp" "$NAME"
elif [ $COMMAND == "uninstall" ]; then
    npm uninstall -C "$TARGET_WD" --cache="/tmp" "$NAME"
fi
