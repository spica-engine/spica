import {FlexElement} from "oziko-ui-kit";
import styles from "./BucketEntryForm.module.scss";
import type {ValidationErrors} from "../../organisms/BucketEntryDrawer/services";

export interface BucketEntryFormProps {
  inputRepresentation: React.ReactNode;
  errors?: ValidationErrors;
  className?: string;
}

export const BucketEntryForm = ({
  inputRepresentation,
  errors,
  className
}: BucketEntryFormProps) => {
  return (
    <FlexElement direction="vertical" gap={10} className={className || styles.formContent}>
      {inputRepresentation}
    </FlexElement>
  );
};

export default BucketEntryForm;

