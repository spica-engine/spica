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
    element: <Layout />,
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute>
            <Navigate to="dashboard" replace />
          </ProtectedRoute>
        )
      },
      {
        path: "app",
        element: (
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        )
      },
      {
        path: "dashboard",
        element: (
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        )
      },
      {
        path: "bucket/:bucketId",
        element: (
          <ProtectedRoute>
            <Bucket />
          </ProtectedRoute>
        )
      },
      {
        path: "passport/identity",
        element: (
          <ProtectedRoute>
            <Identity />
          </ProtectedRoute>
        )
      },
      {
        path: "diagram",
        element: (
          <ProtectedRoute>
            <Diagram />
          </ProtectedRoute>
        )
      }
    ]
  }
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
