/// <reference types='vitest' />
import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {workspaceRoot} from "@nx/devkit";

export default defineConfig({
  base: process.env.BASE_URL || "",
  root: __dirname,
  cacheDir: "../../node_modules/.vite/apps/panel",
  server: {
    port: 4200,
    host: "localhost"
  },
  preview: {
    port: 4300,
    host: "localhost"
  },
  plugins: [react()],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  build: {
    outDir: `${workspaceRoot}/dist/panel`,
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true
    }
  }
});
