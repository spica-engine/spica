import {StrictMode} from "react";
import {BrowserRouter} from "react-router-dom";
import * as ReactDOM from "react-dom/client";
import App from "./app/app";
import AppRouter from "./router";
import "oziko-ui-kit/dist/index.css";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <StrictMode>
    <AppRouter />
  </StrictMode>
);
