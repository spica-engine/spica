import React, {memo, type FC} from "react";
import logo from "../../../assets/images/logo.svg";
import styles from "./Logo.module.scss";
import {FlexElement, type TypeFlexElement} from "oziko-ui-kit";
import logoSmall from "../../../assets/images/logo_small.svg";

type TypeLogo = {
  type?: "withText" | "withoutText";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  imageClassName?: string;
} & TypeFlexElement;

const Logo: FC<TypeLogo> = ({size = "md", type = "withText", imageClassName, ...props}) => {
  return (
    <FlexElement {...props} className={`${props.className} ${styles.logo}`}>
      <img
        src={type == "withText" ? logo : logoSmall}
        alt="logo"
        className={`${styles[size]} ${imageClassName}`}
      ></img>
    </FlexElement>
  );
};

export default memo(Logo);
