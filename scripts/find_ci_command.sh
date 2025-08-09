#!/bin/bash

COMMAND=$1
AFFECTED_BUILDS=$2
AFFECTED_TESTS=$3
result=false

if [[ "$COMMAND" == format:check ]]; then
  result=true

elif [[ "$COMMAND" == build* ]]; then
  if [[ -n "$AFFECTED_BUILDS" ]]; then
    for project in $AFFECTED_BUILDS; do
      if [[ "$project" == api/function/packages* && "$COMMAND" == build:devkit:* ]]; then
        result=true
        break
      else
        SCOPE=$(echo "$COMMAND" | awk -F'[: ]' '{print $2}')
        if [[ "$project" == *"$SCOPE"* ]]; then
          result=true
          break
        fi
      fi
    done
  fi

elif [[ "$COMMAND" == test* ]]; then
  if [[ -n "$AFFECTED_TESTS" ]]; then
    for project in $AFFECTED_TESTS; do
      if [[ "$project" == api/function/packages* && "$COMMAND" == test:devkit:* ]]; then
        result=true
        break
      else
        SCOPE=$(echo "$COMMAND" | awk -F'[: ]' '{print $2}')
        if [[ "$project" == *"$SCOPE"* ]]; then
          if [[ "$SCOPE" != "api" ]]; then
            result=true
            break
          else
            INCLUDED=$(echo "$COMMAND" | sed -n 's/.*--build-arg PROJECTS=\([^ ]*\).*/\1/p')
            # if wildcard included
            if [[ "$INCLUDED" =~ .*/\*\*$ ]]; then
              INCLUDED=$(echo "$INCLUDED" | sed 's/\/\*\*$//')
              # loop included projects              
              if [[ "$project" == "$INCLUDED"* ]]; then
                EXCLUDEDS=$(echo "$COMMAND" | sed -n 's/.*--build-arg EXCLUDE=\([^ ]*\).*/\1/p')
                # remove quotes from EXCLUDEDS
                EXCLUDEDS=$(echo "$EXCLUDEDS" | sed "s/^'//; s/'$//")
                IS_EXCLUDED=false
                # if excluded exist
                if [[ -n "$EXCLUDEDS" ]]; then
                  IFS=',' read -ra EXCLUDED_ARRAY <<< "$EXCLUDEDS"
                  for EXCLUDED in "${EXCLUDED_ARRAY[@]}"; do
                    # if excluded wildcard
                    if [[ "$EXCLUDED" =~ .*/\*\*$ ]]; then
                      EXCLUDED=$(echo "$EXCLUDED" | sed 's/\/\*\*$//')
                      # if excluded
                      if [[ "$project" == "$EXCLUDED"* ]]; then
                        IS_EXCLUDED=true
                      fi
                    else
                      # if excluded
                      if [[ "$project" == "$EXCLUDED" ]]; then
                        IS_EXCLUDED=true
                      fi
                    fi
                  done
                fi
                if [[ "$IS_EXCLUDED" == false ]]; then
                  result=true
                  break
                fi
              fi
            else
              if [[ "$project" == "$INCLUDED" ]]; then
                result=true
                break
              fi
            fi
          fi
        fi
      fi
    done
  fi
fi

echo $result
