import StorageFullAccess from "./storage.fullaccess";
import StorageReadOnlyAccess from "./storage.readonly";

import WebhookFullAccess from "./webhook.fullaccess";
import WebhookReadOnlyAccess from "./webhook.readonly";

import FunctionFullAccess from "./function.fullaccess";
import FunctionReadOnlyAccess from "./function.readonly";

import DashboardFullAccess from "./dashboard.fullaccess";
import DashboardReadOnlyAccess from "./dashboard.readonly";

import BucketFullAccess from "./bucket.fullaccess";
import BucketReadOnlyAccess from "./bucket.readonly";

import ActivityFullAccess from "./activity.fullaccess";
import ActivityReadOnlyAccess from "./activity.readonly";

import ApiKeyFullAccess from "./passport/apikey.fullaccess";
import ApiKeyReadOnlyAccess from "./passport/apikey.readonly";

import IdentityFullAccess from "./passport/identity.fullaccess";
import IdentityReadOnlyAccess from "./passport/identity.readonly";

import PolicyFullAccess from "./passport/policy.fullaccess";
import PolicyReadOnlyAccess from "./passport/policy.readonly";

import StrategyFullAccess from "./passport/strategy.fullaccess";
import StrategyReadOnlyAccess from "./passport/strategy.readonly";

import PassportFullAccess from "./passport/passport.fullaccess";
import PassportReadOnlyAccess from "./passport/passport.readonly";

import PreferenceFullAccess from "./preference.fullaccess";
import PreferenceReadOnlyAccess from "./preference.readonly";

import StatusFullaccess from "./status.fullaccess";

import AssetFullaccess from "./asset.fullaccess";
import AssetReadOnlyAccess from "./asset.readonly";

import VersionControlFullAccess from "./version.fullaccess";

export default [
  ApiKeyFullAccess,
  ApiKeyReadOnlyAccess,

  IdentityFullAccess,
  IdentityReadOnlyAccess,

  PolicyFullAccess,
  PolicyReadOnlyAccess,

  StrategyFullAccess,
  StrategyReadOnlyAccess,

  PassportFullAccess,
  PassportReadOnlyAccess,

  ActivityFullAccess,
  ActivityReadOnlyAccess,

  StorageFullAccess,
  StorageReadOnlyAccess,

  WebhookFullAccess,
  WebhookReadOnlyAccess,

  FunctionFullAccess,
  FunctionReadOnlyAccess,

  DashboardFullAccess,
  DashboardReadOnlyAccess,

  BucketFullAccess,
  BucketReadOnlyAccess,

  PreferenceFullAccess,
  PreferenceReadOnlyAccess,

  StatusFullaccess,

  AssetFullaccess,
  AssetReadOnlyAccess,

  VersionControlFullAccess
];
