import {Drawer, type TypeDrawer} from "oziko-ui-kit";
import styles from "./DrawerShell.module.scss";

function DrawerShell(props: TypeDrawer) {
  return (
    <Drawer {...props} backdropClassName={`${props.backdropClassName || ""} ${styles.backdrop}`} />
  );
}

export default DrawerShell;
