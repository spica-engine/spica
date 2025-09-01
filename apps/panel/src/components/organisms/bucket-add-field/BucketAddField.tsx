import BucketAddFieldBusiness, { type BucketAddFieldBusinessProps, type FormValues } from "./BucketAddFieldBusiness";
import type 
{ SimpleSaveFieldHandlerArg,
TypeSaveFieldHandler as SaveFieldHandler
} from "./BucketAddFieldBusiness";

export const DEFAULT_FORM_VALUES: FormValues = {
  fieldValues: {
    title: "New Inner Field",
    description: "",
  } ,
  configurationValues: {},
  presetValues: {},
  defaultValue: {},
  type: "object"
};


export default function BucketAddField(props: BucketAddFieldBusinessProps) {
  return <BucketAddFieldBusiness {...props} />;
}

export { type SimpleSaveFieldHandlerArg, type SaveFieldHandler };