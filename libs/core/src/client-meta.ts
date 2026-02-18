import {hash} from "@spica-server/core/schema";
import {UAParser} from "ua-parser-js";
import {ClientMeta} from "@spica-server/interface/passport/refresh_token";

export function buildClientMeta(req: any, hashSecret: string): ClientMeta {
  const ip = req.ip || "unknown";
  const rawUserAgent = req.headers?.["user-agent"] || "unknown";

  const fingerprint = hash(`${ip}|${rawUserAgent}`, hashSecret);

  const parser = new UAParser(rawUserAgent);
  const browser = parser.getBrowser();
  const os = parser.getOS();

  const browserLabel = [browser.name, browser.major].filter(Boolean).join(" ");
  const osLabel = [os.name, os.version].filter(Boolean).join(" ");
  const device_label = [browserLabel, osLabel].filter(Boolean).join(" / ") || undefined;

  return {fingerprint, device_label};
}
