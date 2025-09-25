import {StrictMode} from "react";
import * as ReactDOM from "react-dom/client";
import AppRouter from "./router";
import "oziko-ui-kit/dist/index.css";
import "./styles.scss";
import {AuthProvider} from "./contexts/AuthContext";
import {DrawerProvider} from "./contexts/DrawerContext";
import {BucketProvider} from "./contexts/BucketContext";
import {StorageProvider} from "./contexts/StorageContext";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <StrictMode>
    <DrawerProvider>
      <AuthProvider>
        <BucketProvider>
          <StorageProvider>
            <AppRouter />
          </StorageProvider>
        </BucketProvider>
      </AuthProvider>
    </DrawerProvider>
  </StrictMode>
);
