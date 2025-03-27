import React, {type FC, memo} from "react";
import {FlexElement} from "oziko-ui-kit";
import type {TypeFlexElement} from "../../../../../../node_modules/oziko-ui-kit/dist/components/atoms/flex-element/FlexElement";
import styles from "./Section.module.scss";
import "oziko-ui-kit/dist/index.css";

type TypeSection = {
  ref?: React.Ref<HTMLDivElement>;
} & TypeFlexElement;

type TypeSectionComponent = React.FC<TypeSection> & {
  Header: typeof FlexElement;
  Content: typeof FlexElement;
  Footer: typeof FlexElement;
};

const SectionComponent: FC<TypeSection> = ({children, ...props}) => {
  return (
    <FlexElement
      dimensionX="fill"
      dimensionY="fill"
      direction="vertical"
      gap={0}
      {...props}
      className={`${props.className} ${styles.sectionContainer}`}
    >
      {children}
    </FlexElement>
  );
};

const SectionHeader = memo(({children, ...props}: TypeFlexElement) => (
  <FlexElement
    dimensionX="fill"
    alignment="leftTop"
    {...props}
    className={`${styles.header} ${props.className}`}
  >
    {children}
  </FlexElement>
));

const SectionContent = memo(({children, ...props}: TypeFlexElement) => (
  <FlexElement
    dimensionX="fill"
    alignment="leftTop"
    {...props}
    className={`${styles.content} ${props.className}`}
  >
    {children}
  </FlexElement>
));

const SectionFooter = memo(({children, ...props}: TypeFlexElement) => (
  <FlexElement
    dimensionX="fill"
    alignment="leftTop"
    {...props}
    className={`${styles.footer} ${props.className}`}
  >
    {children}
  </FlexElement>
));

const Section = memo(SectionComponent) as unknown as TypeSectionComponent;

Section.Header = SectionHeader;
Section.Content = SectionContent;
Section.Footer = SectionFooter;

export default Section;
