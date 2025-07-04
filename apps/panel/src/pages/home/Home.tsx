import React, {memo} from "react";
import styles from "./Home.module.scss";
import {FlexElement} from "oziko-ui-kit";
import "oziko-ui-kit/dist/index.css";
import VideoDisplay from "../../components/molecules/video-display/VideoDisplay";
import Quicklinks from "../../components/molecules/quicklinks/Quicklinks";
import WelcomeText from "../../components/atoms/welcome-text/WelcomeText";
import BucketTable, {type ColumnType} from "../../components/organisms/bucket-table/BucketTable";

const mockData = [
  {
    id: "1",
    name: "Homepage",
    slug: "homepage",
    user: "john_doe",
    meta_tags: {_id: "642438aab86243423", somein: "somein", someinelse: "someinelse"},
    localization: "23.521, 20.113",
    images: "hero.jpg"
  },
  {
    id: "2",
    name: "Blog",
    slug: "blog",
    user: "jane_smith",
    meta_tags: {_id: "529769810329", somein: "somein", someinelse: "someinelse"},
    localization: "23.521, 20.113",
    pages: ["post-1", "post-2"],
  },
  {
    id: "3",
    name: "Store",
    slug: "store",
    user: "admin",
    meta_tags: {_id: "529769810329", somein: "somein", someinelse: "someinelse"},
    localization: "23.521, 20.113",
    pages: ["product-1", "product-2"],
    images: "storefront.png"
  },
  {
    id: "4",
    name: "Support",
    slug: "support",
    user: "support_user",
    meta_tags: {_id: "529769810329", somein: "somein", someinelse: "someinelse"},
    localization: "23.521, 20.113",
    pages: ["faq", "contact-support"],
    images: "support.png"
  }
];

const columns = [
  {
    header: "_id",
    key: "id",
    width: "10px"
  },
  {
    header: "name",
    key: "name",
    width: "10px",
    type: "string",
    deletable: true,
    showDropdownIcon: true
  },
  {
    header: "slug",
    key: "slug",
    width: "10px",
    type: "string",
    deletable: true,
    showDropdownIcon: true
  },
  {
    header: "user",
    key: "user",
    width: "10px",
    type: "string",
    showDropdownIcon: true
  },
  {
    header: "meta_tags",
    key: "meta_tags",
    width: "10px",
    type: "object",
    showDropdownIcon: true
  },
  {
    header: "localization",
    key: "localization",
    width: "10px",
    type: "location",
    showDropdownIcon: true
  },
  {
    header: "pages",
    key: "pages",
    width: "10px",
    type: "multiple selection",
    showDropdownIcon: true
  },
  {
    header: "images",
    key: "images",
    width: "10px",
    type: "file",
    showDropdownIcon: true
  }
];

const Home = () => {
  return (
    <div className={styles.container}>
      <FlexElement dimensionX="fill" direction="vertical" gap={10} className={styles.content}>
        <WelcomeText />
        <FlexElement dimensionX="fill">
          <Quicklinks />
          <VideoDisplay />
        </FlexElement>
      </FlexElement>
      <BucketTable columns={columns as ColumnType[]} data={mockData} />
    </div>
  );
};

export default memo(Home);
