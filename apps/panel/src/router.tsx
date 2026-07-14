import React from "react";
import {createBrowserRouter, Navigate, RouterProvider} from "react-router-dom";
import Login from "./pages/login/Login";
import App from "./app/app";
import Home from "./pages/home/Home";
import Layout from "./layout/Layout";
import Bucket from "./pages/bucket/Bucket";
import Identity from "./pages/identity/Identity";
import User from "./pages/user/User";
import Diagram from "./pages/diagram/Diagram";
import ProtectedRoute from "./components/guards/ProtectedRoute";
import Storage from "./pages/storage/Storage";
import StorageItem from "./pages/storage-view/StorageView";
import Policy from "./pages/policy/Policy";
import Webhook from "./pages/webhook/Webhook";
import Strategy from "./pages/strategy/Strategy";
import Activities from "./pages/activities/Activities";
import FunctionPage from "./pages/function/FunctionPage";
import FunctionLogPage from "./pages/function-log/FunctionLogPage";
import DashboardView from "./pages/dashboard/DashboardView";
import Config from "./pages/config/Config";
import ConfigModule from "./pages/config/ConfigModule";
import DataStrategy from "./pages/config/DataStrategy";
import RefreshToken from "./pages/refresh-token/RefreshToken";
import SecretsAndVariables from "./pages/secrets-and-variables/SecretsAndVariables";
import ApiKeyPage from "./pages/api-key/ApiKey";
import FunctionVariablesPage from "./pages/function-variables/FunctionVariablesPage";
import ObservabilityBucket from "./pages/observability/ObservabilityBucket";

const router = createBrowserRouter(
  [
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
          path: "dashboard/:dashboardId",
          element: <DashboardView />
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
          path: "bucket/:bucketId/:entryId",
          element: <Bucket />
        },
        {
          path: "passport/identity",
          element: <Identity />
        },
        {
          path: "passport/user",
          element: <User />
        },
        {
          path: "passport/user/profile",
          element: <Navigate to="/passport/observability/bucket" replace />
        },
        {
          path: "passport/policy",
          element: <Policy />
        },
        {
          path: "passport/strategy",
          element: <Strategy />
        },
        {
          path: "passport/refresh-token",
          element: <RefreshToken />
        },
        {
          path: "passport/api-key",
          element: <ApiKeyPage />
        },
        {
          path: "passport/secrets-and-variables",
          children: [
            {
              index: true,
              element: <Navigate to="secrets" replace />
            },
            {
              path: ":tab",
              element: <SecretsAndVariables />
            }
          ]
        },
        {
          path: "activity",
          element: <Activities />
        },
        {
          path: "diagram",
          element: <Diagram />
        },
        {
          path: "storage",
          element: <Storage />
        },
        {
          path: "function/:functionId",
          element: <FunctionPage />
        },
        {
          path: "function-logs",
          element: <FunctionLogPage />
        },
        {
          path: "function-variables",
          children: [
            {
              index: true,
              element: <Navigate to="variables" replace />
            },
            {
              path: ":tab",
              element: <FunctionVariablesPage />
            }
          ]
        },
        {
          path: "webhook/:webhookId",
          element: <Webhook />
        },
        {
          path: "config",
          element: <Config />
        },
        {
          path: "config/data-strategy",
          element: <DataStrategy />
        },
        {
          path: "config/:module",
          element: <ConfigModule />
        },
        {
          path: "passport/observability/bucket",
          element: <ObservabilityBucket />
        },
        {
          path: "passport/observability/user",
          element: <Navigate to="/passport/observability/bucket" replace />
        }
      ]
    },
    {
      path: "storage-view/:storageId",
      element: <StorageItem />
    }
  ],
  {basename: import.meta.env.BASE_URL}
);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
