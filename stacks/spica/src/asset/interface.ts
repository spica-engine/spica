export interface Asset {
  _id: string;
  metadata: {
    name: string;
    uid: string;
    package: string;
  };
}

export function titleCase(str: string) {
  return str
    .replace("_", " ")
    .split(" ")
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
