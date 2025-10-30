import React from "react";
import {type EditorProps} from "../types";
import {Checkbox} from "oziko-ui-kit";

export function withRequired(Component: React.ComponentType<EditorProps>) {
  return function RequiredDecorator(props: EditorProps) {
    return (
      <>
        <Component {...props} />
        <div style={{marginTop: "8px"}}>
          <Checkbox
            label="Required Field"
            checked={props.value.required || false}
            onChange={(e) => props.onChange({...props.value, required: e.target.checked})}
          />
        </div>
      </>
    );
  };
}

