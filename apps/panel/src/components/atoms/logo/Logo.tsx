import React, {memo, type FC} from "react";
import logo from "../../../assets/images/logo.svg";
import styles from "./Logo.module.scss";
import {FlexElement} from "oziko-ui-kit";
import type {TypeFlexElement} from "oziko-ui-kit";

type TypeLogo = {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  imageClassName?: string;
} & TypeFlexElement;

const Logo: FC<TypeLogo> = ({size = "md", imageClassName, ...props}) => {
  return (
    <FlexElement {...props} className={`${props.className} ${styles.logo}`}>
      <img src={logo} alt="logo" className={`${styles[size]} ${imageClassName}`}></img>
    </FlexElement>
  );
};

export default memo(Logo);
