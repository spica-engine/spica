/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { type FC } from "react";
import { FlexElement, Text} from "oziko-ui-kit";
import styles from "./Page.module.scss";

type TypeContentBodyProps = {
  className?: string;
}

type TypeContentHeaderProps = {
  className?: string;
}

type PageProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
  contentBodyProps?: TypeContentBodyProps;
  contentHeaderProps?: TypeContentHeaderProps;
}

const Page: FC<PageProps> = ({title, children, className, contentBodyProps, contentHeaderProps}) => {
  return (
    <div className={`${styles.container} ${className || ""}`}>
      <FlexElement dimensionX="fill" direction="vertical" gap={0} className={`${styles.pageContentBox} ${className || ""}`}>
        <FlexElement dimensionX="fill" direction="vertical" alignment="leftTop" className={`${styles.pageContentHeader} ${contentHeaderProps?.className || ""}`}>
          <Text>{title}</Text>
        </FlexElement>

        <FlexElement dimensionX="fill"  alignment="leftTop" className={`${styles.pageContentBody} ${contentBodyProps?.className || ""}`}>
             {children}
        </FlexElement>
      </FlexElement>
    </div>
  );
};

export default Page;
