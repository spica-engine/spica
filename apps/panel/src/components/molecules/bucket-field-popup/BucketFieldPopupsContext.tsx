import {createContext, useContext, useState, type CSSProperties, type ReactNode} from "react";
import {FieldKind} from "../../../domain/fields";
import type {FieldFormState} from "../../../domain/fields/types";

export type PopupType = "edit-field" | "add-field" | "edit-inner-field" | "add-inner-field";
export type BucketFieldPopup = {
  id: string;
  innerFieldStyles?: CSSProperties;
  fieldKind?: FieldKind;
  popupType?: PopupType;
  initialValues?: FieldFormState;
  forbiddenFieldNames: string[];
};

const BucketFieldPopupsContext = createContext<{
  bucketFieldPopups: BucketFieldPopup[];
  setBucketFieldPopups: React.Dispatch<React.SetStateAction<BucketFieldPopup[]>>;
} | null>(null);

export function BucketFieldPopupsProvider({children}: {children: ReactNode}) {
  const [bucketFieldPopups, setBucketFieldPopups] = useState<BucketFieldPopup[]>([]);

  return (
    <BucketFieldPopupsContext value={{bucketFieldPopups, setBucketFieldPopups}}>
      {children}
    </BucketFieldPopupsContext>
  );
}

export function useBucketFieldPopups() {
  const ctx = useContext(BucketFieldPopupsContext);
  if (!ctx) throw new Error("useBucketFieldPopups must be used inside <BucketFieldPopupsProvider>");
  return ctx;
}
