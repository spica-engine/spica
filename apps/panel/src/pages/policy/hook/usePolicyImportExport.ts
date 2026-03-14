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

  const resetFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
      const metadata = hasStatementField
        ? {
            name: "name" in imported
              ? (imported as { name?: string }).name
              : undefined,
            description: "description" in imported
              ? (imported as { description?: string }).description
              : undefined,
          }
        : {};
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
          ...metadata,
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
          ...metadata,
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
        resetFileInput();
        return;
      }

      const readAndImport = async () => {
        try {
          const text = await file.text();
          const imported = JSON.parse(text);
          const validated = validateImportedData(imported);

          if (!validated) {
            alert("Invalid import format. Expected policy statements JSON.");
            return;
          }

          onImport(validated);
        } catch (error) {
          console.error("Import error:", error);
          alert("Failed to parse imported file. Please ensure it's valid JSON.");
        } finally {
          resetFileInput();
        }
      };

      void readAndImport();
    },
    [onImport, resetFileInput, validateImportedData]
  );

  return {
    fileInputRef,
    handleExport,
    handleImport: triggerImport,
    handleFileChange,
  };
};