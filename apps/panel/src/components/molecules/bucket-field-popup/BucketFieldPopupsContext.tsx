import {createContext, useContext, useState, type ReactNode} from "react";

const BucketFieldPopupsContext = createContext<{
  bucketFieldPopups: string[];
  setBucketFieldPopups: React.Dispatch<React.SetStateAction<string[]>>;
} | null>(null);

export function BucketFieldPopupsProvider({children}: {children: ReactNode}) {
  const [bucketFieldPopups, setBucketFieldPopups] = useState<string[]>([]);

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
