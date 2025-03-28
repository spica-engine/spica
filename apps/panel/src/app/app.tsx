// Uncomment this line to use CSS modules
// import styles from './app.module.css';
import WebhookAdd from "../components/molecules/webhook-add/WebhookAdd";
import NxWelcome from "./nx-welcome";

import {Route, Routes, Link} from "react-router-dom";

export function App() {
  return (
    <div>
      <WebhookAdd></WebhookAdd>
    </div>
  );
}

export default App;
