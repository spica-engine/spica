import React from "react";
import {type EditorProps} from "../types";
import {Checkbox} from "oziko-ui-kit";

export function withTranslatable(Component: React.ComponentType<EditorProps>) {
  return function TranslatableDecorator(props: EditorProps) {
    return (
      <>
        <Component {...props} />
        <div style={{marginTop: "8px"}}>
          <Checkbox
            label="Translatable"
            checked={props.value.translatable || false}
            onChange={(e) => props.onChange({...props.value, translatable: e.target.checked})}
          />
        </div>
      </>
    );
  };
}

