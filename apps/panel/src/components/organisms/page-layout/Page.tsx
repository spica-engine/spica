/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { type FC } from "react";
import { FlexElement, Text} from "oziko-ui-kit";
import styles from "./Page.module.scss";

type PageProps = {
  title: string;
  children: React.ReactNode;
}

const Page: FC<PageProps> = ({title, children}) => {
  return (
    <div className={styles.container}>
      <FlexElement dimensionX="fill" direction="vertical" gap={0} className={styles.pageContentBox}>
        <FlexElement dimensionX="fill" direction="vertical" alignment="leftTop" className={styles.pageContentHeader}>
          <Text>{title}</Text>
        </FlexElement>

        <FlexElement dimensionX="fill"  alignment="leftTop" className={styles.pageContentBody}>
             {children}
        </FlexElement>
      </FlexElement>
    </div>
  );
};

export default Page;
