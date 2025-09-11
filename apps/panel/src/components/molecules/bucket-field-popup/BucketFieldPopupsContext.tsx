import {createContext, useContext, useState, type ReactNode} from "react";
import {FieldKind} from "../../../domain/fields";

export type PopupType = "add-field" | "edit-inner-field" | "add-inner-field";
export type BucketFieldPopup = {
  id: string;
  innerFieldStyles?: any;
  fieldKind?: FieldKind; // normalized central registry kind
  popupType?: PopupType;
  initialValues?: any;
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
