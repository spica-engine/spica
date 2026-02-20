import {hash} from "@spica-server/core/schema";
import {UAParser} from "ua-parser-js";
import {ClientMeta} from "@spica-server/interface/passport/refresh_token";

function truncateIPv4(ip: string): string {
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
}

export function buildClientMeta(req: any, hashSecret: string): ClientMeta {
  const forwarded = req.headers?.["x-forwarded-for"];
  const rawIp = forwarded?.split(",")[0]?.trim() || req.ip || "unknown";

  const ip = truncateIPv4(rawIp);

  const rawUserAgent = req.headers?.["user-agent"] || "unknown";
  const parser = new UAParser(rawUserAgent);
  const browser = parser.getBrowser();
  const os = parser.getOS();

  const browserMajor = browser.major;
  const osMajor = os.version?.split(".")[0];

  const signature = [ip, browser.name, browserMajor, os.name, osMajor].filter(Boolean).join("|");

  const fingerprint = hash(signature, hashSecret);

  const device_label =
    [browser.name, browserMajor, os.name].filter(Boolean).join(" / ") || undefined;

  return {fingerprint, device_label};
}
