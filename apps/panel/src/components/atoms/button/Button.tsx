import {Button, type TypeButton} from "oziko-ui-kit";

const ButtonWithRef = Button as React.NamedExoticComponent<
  TypeButton & {ref: React.Ref<HTMLButtonElement> | undefined}
>;

export default ButtonWithRef;
