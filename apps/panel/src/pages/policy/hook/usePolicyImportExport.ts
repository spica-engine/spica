// hooks/usePolicyImportExport.ts
import { useCallback, useRef } from 'react';
import type { PolicyItem } from '../Policy';
import type { DisplayedStatement, PolicyStatement } from '../policyStatements';
import { groupStatements, flattenStatements } from '../policyStatements';

interface UsePolicyImportExportProps {
  name: string;
  description: string;
  displayedStatements: DisplayedStatement[];
  selectedPolicy: PolicyItem | null;
  onImport: (data: {
    name?: string;
    description?: string;
    statements: DisplayedStatement[];
  }) => void;
}

export const usePolicyImportExport = ({
  name,
  description,
  displayedStatements,
  selectedPolicy,
  onImport,
}: UsePolicyImportExportProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    const exportPolicy: Partial<PolicyItem> & Pick<PolicyItem, "name" | "description" | "statement"> = {
      name: name.trim(),
      description,
      statement: flattenStatements(displayedStatements),
    };

    // Only include optional fields if they exist
    if (selectedPolicy?._id) {
      exportPolicy._id = selectedPolicy._id;
    }
    if (selectedPolicy?.system) {
      exportPolicy.system = selectedPolicy.system;
    }

    const fileName = `${exportPolicy.name || "policy"}.json`;
    const json = JSON.stringify(exportPolicy, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    
    URL.revokeObjectURL(url);
  }, [description, displayedStatements, name, selectedPolicy]);

  const triggerImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const validateImportedData = useCallback(
    (imported: unknown): {
      statements: DisplayedStatement[];
      name?: string;
      description?: string;
    } | null => {
      if (!imported || typeof imported !== "object") {
        return null;
      }

      const hasStatementField = "statement" in imported;
      const payload = hasStatementField
        ? (imported as { statement?: unknown }).statement
        : imported;

      if (!Array.isArray(payload)) {
        return null;
      }

      // Check if it's already in DisplayedStatement format
      const isDisplayedFormat = payload.every(
        (item) =>
          item &&
          typeof item === "object" &&
          "module" in item &&
          Array.isArray((item as { actions?: unknown }).actions)
      );

      if (isDisplayedFormat) {
        return {
          statements: payload as DisplayedStatement[],
          name: hasStatementField && "name" in imported
            ? (imported as { name?: string }).name
            : undefined,
          description: hasStatementField && "description" in imported
            ? (imported as { description?: string }).description
            : undefined,
        };
      }

      // Check if it's in flat PolicyStatement format
      const isFlatFormat = payload.every(
        (item) =>
          item &&
          typeof item === "object" &&
          "module" in item &&
          "action" in item
      );

      if (isFlatFormat) {
        return {
          statements: groupStatements(payload as PolicyStatement[]),
          name: hasStatementField && "name" in imported
            ? (imported as { name?: string }).name
            : undefined,
          description: hasStatementField && "description" in imported
            ? (imported as { description?: string }).description
            : undefined,
        };
      }

      return null;
    },
    []
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      const isJsonFile =
        file.type === "application/json" ||
        file.name.toLowerCase().endsWith(".json");

      if (!isJsonFile) {
        alert("Only JSON files are supported.");
        event.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          const validated = validateImportedData(imported);

          if (!validated) {
            alert("Invalid import format. Expected policy statements JSON.");
            return;
          }

          onImport(validated);
        } catch (error) {
          console.error("Import error:", error);
          alert("Failed to parse imported file. Please ensure it's valid JSON.");
        }
      };

      reader.onerror = () => {
        alert("Failed to read file. Please try again.");
      };

      reader.readAsText(file);
      event.target.value = ""; // Reset input
    },
    [validateImportedData, onImport]
  );

  return {
    fileInputRef,
    handleExport,
    handleImport: triggerImport,
    handleFileChange,
  };
};