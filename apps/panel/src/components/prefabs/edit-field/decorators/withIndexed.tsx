import React from "react";
import {type EditorProps} from "../types";
import {Checkbox} from "oziko-ui-kit";

export function withIndexed(Component: React.ComponentType<EditorProps>) {
  return function IndexedDecorator(props: EditorProps) {
    return (
      <>
        <Component {...props} />
        <div style={{marginTop: "8px"}}>
          <Checkbox
            label="Indexed field in database"
            checked={props.value.indexed || false}
            onChange={(e) => props.onChange({...props.value, indexed: e.target.checked})}
          />
        </div>
      </>
    );
  };
}

