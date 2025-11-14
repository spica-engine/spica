// @owner Kanan Gasimov

import React from "react";
import {type EditorProps} from "../types";
import {Checkbox} from "oziko-ui-kit";

export function withUnique(Component: React.ComponentType<EditorProps>) {
  return function UniqueDecorator(props: EditorProps) {
    return (
      <>
        <Component {...props} />
        <div style={{marginTop: "8px"}}>
          <Checkbox
            label="Unique Values"
            checked={props.value.unique || false}
            onChange={(e) => props.onChange({...props.value, unique: e.target.checked})}
          />
        </div>
      </>
    );
  };
}

