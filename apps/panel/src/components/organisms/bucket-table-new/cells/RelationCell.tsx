import React, { useState, useEffect } from "react";
import type { CellRendererProps, CellKeyboardHandler } from "../types";
import { BaseCellRenderer } from "./BaseCellRenderer";

/**
 * Relation Cell - Opens a modal on Enter key
 * This is a simplified version. You can expand this to show actual related data
 */
export const RelationCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  property,
  isFocused,
  onRequestBlur,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setIsModalOpen(false);
    }
  }, [isFocused]);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    onRequestBlur();
  };

  const handleSelectRelation = (selectedValue: any) => {
    onChange(selectedValue);
    handleCloseModal();
  };

  const getDisplayValue = () => {
    if (!value) return "Select relation...";
    if (typeof value === "object" && value._id) {
      return `Related: ${value._id}`;
    }
    return `Related: ${value}`;
  };

  return (
    <>
      <BaseCellRenderer isFocused={isFocused} onClick={handleOpenModal}>
        <span
          style={{
            color: value ? "#1976d2" : "#999",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          {getDisplayValue()}
        </span>
      </BaseCellRenderer>

      {isModalOpen && (
        <RelationModal
          bucketId={property.bucketId}
          relationType={property.relationType}
          currentValue={value}
          onSelect={handleSelectRelation}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

/**
 * Simple modal for relation selection
 * In a real implementation, this would fetch and display related bucket data
 */
const RelationModal: React.FC<{
  bucketId?: string;
  relationType?: string;
  currentValue: any;
  onSelect: (value: any) => void;
  onClose: () => void;
}> = ({ bucketId, relationType, currentValue, onSelect, onClose }) => {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "8px",
          minWidth: "400px",
          maxWidth: "600px",
          maxHeight: "80vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Select Relation</h3>
        <p>Bucket ID: {bucketId}</p>
        <p>Relation Type: {relationType}</p>
        <p style={{ fontSize: "12px", color: "#666" }}>
          Current: {JSON.stringify(currentValue)}
        </p>

        <div style={{ marginTop: "16px" }}>
          <p style={{ fontSize: "14px", color: "#666" }}>
            This is a placeholder modal. Implement actual relation selection here.
          </p>
        </div>

        <div style={{ marginTop: "24px", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export const RelationCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: (event, context) => {
    if (event.key === "Enter") {
      // Open modal - this is handled by the component
      return true;
    }
    
    if (event.key === "Escape") {
      // Close modal/blur
      context.onRequestBlur();
      return true;
    }
    
    return false;
  }
};

