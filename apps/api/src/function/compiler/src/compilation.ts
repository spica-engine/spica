export interface Compilation {
  cwd: string;
  outDir: string;
  entrypoints: Entrypoints;
}

export interface Entrypoints {
  build: string;
  runtime: string;
}

export interface Diagnostic {
  code: number;
  category: number;
  text: string;
  start: {
    line: number;
    column: number;
  };
  end: {
    line: number;
    column: number;
  };
}
