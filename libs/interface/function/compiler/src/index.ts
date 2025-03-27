export interface Compilation {
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
  entrypoints: {
    build: string;
    runtime: string;
  };
}
