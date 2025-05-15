import React from "react";
import {createBrowserRouter, RouterProvider} from "react-router-dom";
import Login from "./pages/login/Login";
import App from "./app/app";
import Home from "./pages/home/Home";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Login />,
    children: [
      {
        path: "",
        element: <Login />
      }
    ]
  },
  {
    path: "app",
    element: <App />
  },
  {
    path: "home",
    element: <Home />
  }
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
