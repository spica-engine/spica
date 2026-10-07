import {createHash} from "crypto";

export function hashBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function assetKey(functionName: string, filename: string): string {
  return `functions/${functionName}/${filename}`;
}
