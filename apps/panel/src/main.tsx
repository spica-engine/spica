import {StrictMode} from "react";
import * as ReactDOM from "react-dom/client";
import AppRouter from "./router";
import "oziko-ui-kit/dist/index.css";
import "./styles.scss";
import {AuthProvider} from "./contexts/AuthContext";
import {DrawerProvider} from "./contexts/DrawerContext";
import {StorageProvider} from "./contexts/StorageContext";
import {Provider} from "react-redux";
import {store} from "./store";
import {BucketProvider} from "./contexts/BucketContext";
import {DndProvider} from "react-dnd";
import {HTML5Backend} from "react-dnd-html5-backend";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <StrictMode>
    <Provider store={store}>
      <DndProvider backend={HTML5Backend}>
        <DrawerProvider>
          <AuthProvider>
            <BucketProvider>
              <StorageProvider>
                <AppRouter />
              </StorageProvider>
            </BucketProvider>
          </AuthProvider>
        </DrawerProvider>
      </DndProvider>
    </Provider>
  </StrictMode>
);
