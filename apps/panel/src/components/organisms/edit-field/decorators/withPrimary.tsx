// @owner Kanan Gasimov

import React from "react";
import {type EditorProps} from "../types";
import {Checkbox} from "oziko-ui-kit";

export function withPrimary(Component: React.ComponentType<EditorProps>) {
  return function PrimaryDecorator(props: EditorProps) {
    return (
      <>
        <Component {...props} />
        <div style={{marginTop: "16px"}}>
          <Checkbox
            label="Primary Field"
            checked={props.value.primary || false}
            onChange={(e) => props.onChange({...props.value, primary: e.target.checked})}
          />
        </div>
      </>
    );
  };
}

