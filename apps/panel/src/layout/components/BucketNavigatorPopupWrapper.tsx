import {useState} from "react";
import BucketNavigatorPopup, {
  type TypeBucketNavigatorPopup
} from "../../components/molecules/bucket-navigator-popup/BucketNavigatorPopup";

export type BucketNavigatorPopupWrapperProps = Omit<TypeBucketNavigatorPopup, "isOpen" | "setIsOpen">;

export const BucketNavigatorPopupWrapper = (props: BucketNavigatorPopupWrapperProps) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  return <BucketNavigatorPopup isOpen={isPopupOpen} setIsOpen={setIsPopupOpen} {...props} />;
};
