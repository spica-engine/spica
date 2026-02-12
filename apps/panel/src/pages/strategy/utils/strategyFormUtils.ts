/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import * as Yup from "yup";
import type { AuthenticationStrategy } from "../../../store/api/authenticationStrategyApi";

export const STRATEGY_TYPE_OPTIONS = [
  { value: "saml", label: "SAML" },
  { value: "oauth", label: "OAuth" }
];

export const addStrategySchema = Yup.object({
  name: Yup.string().required("Name is required"),
  title: Yup.string().required("Title is required"),
  type: Yup.string().oneOf(["saml", "oauth"]).required("Type is required"),
  loginUrl: Yup.string().required("Login URL is required"),
  logoutUrl: Yup.string().required("Logout URL is required"),
  certificate: Yup.string().required("Certificate is required")
});

export type AddStrategyFormValues = Yup.InferType<typeof addStrategySchema>;

export const initialFormValues: AddStrategyFormValues = {
  name: "",
  title: "",
  type: "saml",
  loginUrl: "",
  logoutUrl: "",
  certificate: ""
};

export const strategyToFormValues = (
  strategy: AuthenticationStrategy
): AddStrategyFormValues => ({
  name: strategy.name ?? "",
  title: strategy.title ?? "",
  type: strategy.type,
  loginUrl: strategy.options?.ip?.login_url ?? "",
  logoutUrl: strategy.options?.ip?.logout_url ?? "",
  certificate: strategy.options?.ip?.certificate ?? ""
});

export const areFormValuesEqual = (
  a: AddStrategyFormValues,
  b: AddStrategyFormValues
): boolean =>
  a.name.trim() === b.name.trim() &&
  a.title.trim() === b.title.trim() &&
  a.type === b.type &&
  a.loginUrl.trim() === b.loginUrl.trim() &&
  a.logoutUrl.trim() === b.logoutUrl.trim() &&
  a.certificate.trim() === b.certificate.trim();
