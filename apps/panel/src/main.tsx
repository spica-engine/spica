import {StrictMode} from "react";
import * as ReactDOM from "react-dom/client";
import AppRouter from "./router";
import "oziko-ui-kit/dist/index.css";
import "./styles.scss";
import {UIProvider} from "./context/UIContext";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <StrictMode>
    <UIProvider>
      <AppRouter />
    </UIProvider>
  </StrictMode>
);
