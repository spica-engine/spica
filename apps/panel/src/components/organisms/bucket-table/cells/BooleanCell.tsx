import React, {useCallback, useEffect, useRef} from "react";
import {BooleanMinimizedInput, Switch} from "oziko-ui-kit";
import type {CellRendererProps} from "../types";
import {useCellState} from "../useCellSelection";
import styles from "./Cells.module.scss";

export const BooleanCell: React.FC<CellRendererProps> = ({value, onChange, propertyKey, rowId}) => {
  const {isSelected, isEditing, isEditable, select, exitEdit} = useCellState(rowId, propertyKey);

  const checked = !!value;
  const checkedRef = useRef(checked);
  checkedRef.current = checked;

  // Enter/Space activation arrives as isEditing:false→true from the provider; a
  // toggle cell interprets that single edit-request as one action, then exits.
  const prevEditing = useRef(false);
  useEffect(() => {
    if (isEditing && !prevEditing.current) {
      if (isEditable) onChange(!checkedRef.current);
      exitEdit();
    }
    prevEditing.current = isEditing;
  }, [isEditing, isEditable, onChange, exitEdit]);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      // First click selects; once selected the interactive toggle owns the flip
      // (its own onChange commits), so the cell click must not double-toggle.
      if (!isSelected) select();
    },
    [isSelected, select]
  );

  // Flipping the switch commits the new boolean, then hands focus back to the
  // container so keyboard activation isn't double-handled by the toggle span.
  const handleToggle = useCallback(
    (newChecked: boolean) => {
      if (isEditable) onChange(newChecked);
      select();
    },
    [isEditable, onChange, select]
  );

  const className = [styles.readDisplay, isSelected && styles.cellSelected]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} onClick={handleClick}>
      {isSelected && isEditable ? (
        // Selected+editable: a real track+knob Switch so the interactive state is
        // visibly distinct from the at-rest "true"/"false" glyph and invites a flip.
        <Switch
          checked={checked}
          size="small"
          onChange={handleToggle}
          containerProps={{className: styles.booleanSwitch}}
        />
      ) : (
        <BooleanMinimizedInput checked={checked} />
      )}
    </div>
  );
};
