import React from "react";
import {createBrowserRouter, RouterProvider} from "react-router-dom";
import Login from "./pages/login/Login";
import App from "./app/app";
import Home from "./pages/home/Home";
import Layout from "./layout/Layout";

const router = createBrowserRouter([
  {
    path: "/passport/identify",
    element: <Login />
  },
  {
    element: <Layout />,
    children: [
      {
        path: "app",
        element: <App />
      },
      {
        path: "home",
        element: <Home />
      }
    ]
  }
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
