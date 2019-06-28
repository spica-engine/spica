import * as path from "path";

/**
 * Build a relative path from one file path to another file path.
 */
export function buildRelativePath(from: string, to: string): string {
  from = path.normalize(from);
  to = path.normalize(to);

  // Convert to arrays.
  const fromParts = from.split("/");
  const toParts = to.split("/");

  // Remove file names (preserving destination)
  fromParts.pop();
  const toFileName = toParts.pop();

  const relativePath = path.relative(
    path.normalize(fromParts.join("/")),
    path.normalize(toParts.join("/"))
  );
  let pathPrefix = "";

  // Set the path prefix for same dir or child dir, parent dir starts with `..`
  if (!relativePath) {
    pathPrefix = ".";
  } else if (!relativePath.startsWith(".")) {
    pathPrefix = `./`;
  }
  if (pathPrefix && !pathPrefix.endsWith("/")) {
    pathPrefix += "/";
  }

  return pathPrefix + (relativePath ? relativePath + "/" : "") + toFileName;
}

/**
 * Strips the typescript extension and clears index filenames
 * foo.ts -> foo
 * index.ts -> empty
 */
export function stripTsExtension(filename: string | undefined) {
  return filename ? filename.replace(/(\.ts)|(index\.ts)$/, "") : "";
}
