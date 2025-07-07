import {StrictMode} from "react";
import * as ReactDOM from "react-dom/client";
import AppRouter from "./router";
import "oziko-ui-kit/dist/index.css";
import "./styles.scss";
import {AuthProvider} from "./contexts/AuthContext";
import {DrawerProvider} from "./contexts/DrawerContext";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <StrictMode>
    <AuthProvider>
      <DrawerProvider>
        <AppRouter />
      </DrawerProvider>
    </AuthProvider>
  </StrictMode>
);
