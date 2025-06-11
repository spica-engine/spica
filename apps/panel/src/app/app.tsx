// Uncomment this line to use CSS modules
// import styles from './app.module.css';
import {useState} from "react";
import ProfilePopover from "../components/molecules/profile-popover/ProfilePopover";
import NxWelcome from "./nx-welcome";

import {Route, Routes, Link} from "react-router-dom";

export function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const handleThemeToggle = (checked: boolean) => {
    setIsDarkMode(checked);
    // Add more logic here, like saving to localStorage or calling context
    console.log("Theme changed to:", checked ? "Dark" : "Light");
  };

  return (
    <div>
      {/* <NxWelcome title="@spica/panel"/> */}

      {/* START: routes */}
      {/* These routes and navigation have been generated for you */}
      {/* Feel free to move and update them to fit your needs */}
      {/* <br/>
    <hr/>
    <br/>
    <div role="navigation">
      <ul>
        <li><Link to="/">Home</Link></li>
        <li><Link to="/page-2">Page 2</Link></li>
      </ul>
    </div>
    <Routes>
      <Route
        path="/"
        element={
          <div>This is the generated root route. <Link to="/page-2">Click here for page 2.</Link></div>
        }
      />
      <Route
        path="/page-2"
        element={
          <div><Link to="/">Click here to go back to root page.</Link></div>
        }
      />
    </Routes> */}
      <ProfilePopover
        theme={isDarkMode ? "Dark" : "Light"}
        switchProps={{
          checked: isDarkMode,
          onChange: handleThemeToggle
        }}
        profileOnClick={() => console.log("Profile clicked")}
        logoutOnClick={() => console.log("Logout clicked")}
      />

      {/* END: routes */}
    </div>
  );
}

export default App;
