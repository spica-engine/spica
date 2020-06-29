/// <reference lib="webworker" />
import * as ts from "prettier/parser-typescript";
import {format} from "prettier/standalone";

addEventListener("message", ({data: {value, tabSize, useSpaces}}) => {
  postMessage(
    format(value, {
      parser: "typescript",
      plugins: [ts],
      tabWidth: tabSize,
      useTabs: !useSpaces,
      printWidth: 100,
      jsxBracketSameLine: true
    })
  );
});
