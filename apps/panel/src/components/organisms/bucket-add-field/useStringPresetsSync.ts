import {useRef, useEffect} from "react";
import {Countries, Days, EmailRegex, PhoneNumberRegex} from "./enums";

type ConfigurationValue = {
  [k: string]: string | boolean | never[];
};

type UseStringPresetsSyncProps = {
  type: string;
  fieldValues: ConfigurationValue;
  setFieldValues: React.Dispatch<React.SetStateAction<ConfigurationValue>>;
};

const ENUMERATION_PRESETS = {
  Countries,
  Days
} as const;

const REGEX_PRESETS = {
  Email: EmailRegex,
  "Phone Number": PhoneNumberRegex
} as const;

export default function useStringPresetsSync({
  type,
  fieldValues,
  setFieldValues
}: UseStringPresetsSyncProps) {
  const previousPresets = useRef<string[]>([]);
  const wasEnumerated = useRef(false);
  const hadPattern = useRef(false);

  useEffect(() => {
    if (type !== "string" || fieldValues.arrayType !== "string") return;

    const currentPresets = fieldValues.presets as string[];
    const isEnumeratedNow = fieldValues.makeEnumerated as boolean;
    const hasPatternNow = fieldValues.definePattern as boolean;

    // Handle cleanup when enumeration is disabled
    if (wasEnumerated.current && !isEnumeratedNow) {
      cleanupEnumerationPresets(currentPresets, setFieldValues);
      updateRefs(currentPresets, false, hadPattern.current);
      return;
    } else if (!wasEnumerated.current && isEnumeratedNow) {
      updateRefs(currentPresets, true, hadPattern.current);
      return;
    }

    // Handle cleanup when pattern definition is disabled
    if (hadPattern.current && !hasPatternNow) {
      cleanupPatternPresets(currentPresets, setFieldValues);
      updateRefs(currentPresets, wasEnumerated.current, false);
      return;
    } else if (!hadPattern.current && hasPatternNow) {
      updateRefs(currentPresets, isEnumeratedNow, hasPatternNow);
      return;
    }

    // Process enumeration presets
    const updatedEnumeratedValues = processEnumerationPresets(
      currentPresets,
      previousPresets.current,
      fieldValues.enumeratedValues as string[]
    );

    // Process regex presets
    const updatedRegexString = processRegexPresets(
      currentPresets,
      previousPresets.current,
      fieldValues.regularExpression as string
    );

    // Determine new flags based on processed data
    const shouldMakeEnumerated = updatedEnumeratedValues.length > 0;
    const shouldDefinePattern = updatedRegexString.length > 0;

    // Update configuration
    setFieldValues({
      ...fieldValues,
      enumeratedValues: updatedEnumeratedValues as never[],
      makeEnumerated: shouldMakeEnumerated,
      regularExpression: updatedRegexString,
      definePattern: shouldDefinePattern
    });

    // Update refs for next iteration
    updateRefs(currentPresets, shouldMakeEnumerated, shouldDefinePattern);
  }, [fieldValues.presets]);

  function cleanupEnumerationPresets(
    presets: string[],
    setter: React.Dispatch<React.SetStateAction<ConfigurationValue>>
  ) {
    const filteredPresets = presets.filter(
      preset => !Object.keys(ENUMERATION_PRESETS).includes(preset)
    );

    setter(prev => ({
      ...prev,
      enumeratedValues: [],
      presets: filteredPresets as never[]
    }));

    previousPresets.current = filteredPresets;
    wasEnumerated.current = false;
  }

  function cleanupPatternPresets(
    presets: string[],
    setter: React.Dispatch<React.SetStateAction<ConfigurationValue>>
  ) {
    const filteredPresets = presets.filter(preset => !Object.keys(REGEX_PRESETS).includes(preset));

    setter(prev => ({
      ...prev,
      regularExpression: "",
      presets: filteredPresets as never[]
    }));

    previousPresets.current = filteredPresets;
    hadPattern.current = false;
  }

  function processEnumerationPresets(
    currentPresets: string[],
    oldPresets: string[],
    currentValues: string[]
  ): string[] {
    const updatedValues = [...currentValues];

    Object.entries(ENUMERATION_PRESETS).forEach(([presetName, presetValues]) => {
      const isCurrentlySelected = currentPresets.includes(presetName);
      const wasPreviouslySelected = oldPresets.includes(presetName);

      if (isCurrentlySelected && !wasPreviouslySelected) {
        // Add values from newly selected preset
        updatedValues.push(...presetValues);
      } else if (!isCurrentlySelected && wasPreviouslySelected) {
        // Remove values from deselected preset
        presetValues.forEach(value => {
          const index = updatedValues.indexOf(value);
          if (index > -1) {
            updatedValues.splice(index, 1);
          }
        });
      }
    });

    return updatedValues;
  }

  function processRegexPresets(
    currentPresets: string[],
    oldPresets: string[],
    currentRegexString: string
  ): string {
    const regexArray = currentRegexString ? currentRegexString.split("|") : [];

    Object.entries(REGEX_PRESETS).forEach(([presetName, presetPattern]) => {
      const isCurrentlySelected = currentPresets.includes(presetName);
      const wasPreviouslySelected = oldPresets.includes(presetName);

      if (isCurrentlySelected && !wasPreviouslySelected) {
        // Add pattern from newly selected preset
        regexArray.push(presetPattern);
      } else if (!isCurrentlySelected && wasPreviouslySelected) {
        // Remove pattern from deselected preset
        const index = regexArray.indexOf(presetPattern);
        if (index > -1) {
          regexArray.splice(index, 1);
        }
      }
    });

    return regexArray.join("|");
  }

  function updateRefs(presets: string[], enumerated: boolean, pattern: boolean) {
    previousPresets.current = presets;
    wasEnumerated.current = enumerated;
    hadPattern.current = pattern;
  }
}
