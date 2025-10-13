import React from "react";
import {createBrowserRouter, Navigate, RouterProvider} from "react-router-dom";
import Login from "./pages/login/Login";
import App from "./app/app";
import Home from "./pages/home/Home";
import Layout from "./layout/Layout";
import Bucket from "./pages/bucket/Bucket";
import Identity from "./pages/identity/Identity";
import Diagram from "./pages/diagram/Diagram";
import ProtectedRoute from "./components/guards/ProtectedRoute";

const router = createBrowserRouter([
  {
    path: "/passport/identify",
    element: <Login />
  },
  {
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="dashboard" replace />
      },
      {
        path: "app",
        element: <App />
      },
      {
        path: "dashboard",
        element: <Home />
      },
      {
        path: "bucket/:bucketId",
        element: <Bucket />
      },
      {
        path: "passport/identity",
        element: <Identity />
      },
      {
        path: "diagram",
        element: <Diagram />
      }
    ]
  }
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
