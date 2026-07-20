export interface BuildMeta {
  cwd: string;
  outDir: string;
  entrypoints: Entrypoints;
}

interface Entrypoints {
  build: string;
  runtime: string;
}

export interface Description {
  name: string;
  title: string;
  entrypoints: Entrypoints;
}

export interface BuildDiagnostic {
  code: number | string;
  category: number;
  text: string;
  start: {line: number; column: number};
  end: {line: number; column: number};
}

export interface BuildStrategy {
  description: Description;
  build(meta: BuildMeta): Promise<void>;
  kill(): Promise<void>;
}

export enum BuilderType {
  Legacy = "legacy",
  Rollup = "rollup"
}

export const SUPPORTED_LANGUAGES = ["typescript", "javascript"];
