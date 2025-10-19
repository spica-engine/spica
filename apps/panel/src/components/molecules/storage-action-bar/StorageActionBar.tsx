import {FlexElement, FluidContainer, Icon, Button, Popover} from "oziko-ui-kit";
import SearchBar from "../../atoms/search-bar/SearchBar";
import styles from "./StorageActionBar.module.scss";

export default function StorageActionBar() {

  return (
    <FluidContainer
      className={styles.actionBar}
      prefix={{
        children: <SearchBar />
      }}
      suffix={{
        children: (
          <FlexElement>
            <Button className={styles.actionBarButton} variant="filled">
              <Icon name="sort" />
              Sort
            </Button>
            <Button className={styles.actionBarButton} variant="filled">
              <Icon name="refresh" />
              Refresh
            </Button>
            <Button className={styles.actionBarButton} variant="filled">
              <Icon name="plus" />
              Upload Files
            </Button>
            <Button className={styles.actionBarButton} variant="filled">
              <Icon name="plus" />
              Create New Folder
            </Button>
          </FlexElement>
        )
      }}
    />
  );
}
