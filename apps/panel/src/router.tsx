import React from "react";
import {createBrowserRouter, RouterProvider} from "react-router-dom";
import Login from "./pages/login/Login";
import App from "./app/app";

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
  }
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
