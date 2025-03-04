export interface Compilation {
  cwd: string;
  entrypoint: string;
  outDir: string;
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
