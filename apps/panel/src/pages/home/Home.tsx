import React, {memo} from "react";
import styles from "./Home.module.scss";
import {FlexElement} from "oziko-ui-kit";
import "oziko-ui-kit/dist/index.css";
import VideoDisplay from "../../components/molecules/video-display/VideoDisplay";
import Quicklinks from "../../components/molecules/quicklinks/Quicklinks";
import WelcomeText from "../../components/atoms/welcome-text/WelcomeText";
import BucketTable, {type ColumnType} from "../../components/organisms/bucket-table/BucketTable";

// Temporary mock data used for testing; will be removed once the table passes manual testing.
const mockData = [
  {
    id: "64244c01d9e654002c973911",
    name: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation",
    slug: "/test",
    user: "akhnos",
    meta_tags: {_id: "642438aab86a3423", somein: "somein", someinelse: "someinelse"},
    localization: "23.521, 20.113",
    pages: ["home", "about"]
  },
  {
    id: "64244c01d9e654002c973911",
    name: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation",
    slug: "/test",
    user: "akhnos",
    meta_tags: {_id: "642438aab86a3423", somein: "somein", someinelse: "someinelse"},
    localization: "23.521, 20.113",
    pages: ["home", "about"]
  },
  {
    id: "64244c01d9e654002c973911",
    name: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation",
    slug: "/test",
    user: "akhnos",
    meta_tags: {_id: "642438aab86a3423", somein: "somein", someinelse: "someinelse"},
    localization: "23.521, 20.113",
    pages: ["home", "about"]
  },
  {
    id: "64244c01d9e654002c973911",
    name: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation",
    slug: "/test",
    user: "akhnos",
    meta_tags: {_id: "642438aab86a3423", somein: "somein", someinelse: "someinelse"},
    localization: "23.521, 20.113",
    pages: ["home", "about"]
  },
  {
    id: "64244c01d9e654002c973911",
    name: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation",
    slug: "/test",
    user: "akhnos",
    meta_tags: {_id: "642438aab86a3423", somein: "somein", someinelse: "someinelse"},
    localization: "23.521, 20.113",
    pages: ["home", "about"]
  },
  {
    id: "64244c01d9e654002c973911",
    name: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation",
    slug: "/test",
    user: "akhnos",
    meta_tags: {_id: "642438aab86a3423", somein: "somein", someinelse: "someinelse"},
    localization: "23.521, 20.113",
    pages: ["home", "about"]
  },
  {
    id: "64244c01d9e654002c973911",
    name: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation",
    slug: "/test",
    user: "akhnos",
    meta_tags: {_id: "642438aab86a3423", somein: "somein", someinelse: "someinelse"},
    localization: "23.521, 20.113",
    pages: ["home", "about"]
  },
  {
    id: "64244c01d9e654002c973911",
    name: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation",
    slug: "/test",
    user: "akhnos",
    meta_tags: {_id: "642438aab86a3423", somein: "somein", someinelse: "someinelse"},
    localization: "23.521, 20.113",
    pages: ["home", "about"]
  },
  {
    id: "64244c01d9e654002c973911",
    name: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation",
    slug: "/test",
    user: "akhnos",
    meta_tags: {_id: "642438aab86a3423", somein: "somein", someinelse: "someinelse"},
    localization: "23.521, 20.113",
    pages: ["home", "about"]
  },
  {
    id: "64244c01d9e654002c973911",
    name: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation",
    slug: "/test",
    user: "akhnos",
    meta_tags: {_id: "642438aab86a3423", somein: "somein", someinelse: "someinelse"},
    localization: "23.521, 20.113",
    pages: ["home", "about"]
  },
  {
    id: "64244c01d9e654002c973911",
    name: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation",
    slug: "/test",
    user: "akhnos",
    meta_tags: {_id: "642438aab86a3423", somein: "somein", someinelse: "someinelse"},
    localization: "23.521, 20.113",
    pages: ["home", "about"]
  }
];

const columns = [
  {
    header: "_id",
    key: "id",
    width: "10px",
    type: "string",
    showDropdownIcon: true,
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
        <BucketTable columns={columns as ColumnType[]} data={mockData} />
      </FlexElement>
    </div>
  );
};

export default memo(Home);
