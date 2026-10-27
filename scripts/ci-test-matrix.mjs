#!/usr/bin/env node
// Turns the affected test projects into a CI matrix that says which services each project's
// specs need, so a job only starts those. A project that is not found needs everything.
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const SERVICES = ["mongodb", "postgresql", "rabbitmq", "mailer"];

const RULES = {
  mongodb: /database-testing|MONGODB_URL/,
  postgresql: /contractSuite\s*\(|DatabaseTestingModule\s*\.\s*postgres\s*\(|createPostgresDatabase\s*\(|POSTGRES_URL/,
  rabbitmq: /RABBITMQ_(URL|STREAM_HOST|STREAM_PORT)/,
  mailer: /MAILER_URL/
};

export function specNeeds(text) {
  return Object.fromEntries(SERVICES.map(service => [service, RULES[service].test(text)]));
}

function projectRoots(root) {
  const roots = new Map();
  const files = execFileSync("git", ["ls-files", "*project.json"], {cwd: root, encoding: "utf8"})
    .split("\n")
    .filter(Boolean);
  for (const file of files) {
    try {
      const {name} = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
      if (name) roots.set(name, path.dirname(file).split(path.sep).join("/"));
    } catch {
      continue;
    }
  }
  return roots;
}

function specsOf(root, directory, nestedRoots) {
  const specs = [];
  const walk = current => {
    for (const entry of fs.readdirSync(path.join(root, current), {withFileTypes: true})) {
      const relative = `${current}/${entry.name}`;
      if (!entry.isDirectory()) {
        if (entry.name.endsWith(".spec.ts")) specs.push(relative);
      } else if (entry.name != "node_modules" && entry.name != "dist" && !nestedRoots.has(relative)) {
        walk(relative);
      }
    }
  };
  walk(directory);
  return specs;
}

export function buildMatrix(root, projects) {
  const roots = projectRoots(root);
  const allRoots = new Set(roots.values());

  return projects.map(project => {
    const directory = roots.get(project);
    if (!directory) {
      return {project, ...Object.fromEntries(SERVICES.map(service => [service, true]))};
    }
    const needs = Object.fromEntries(SERVICES.map(service => [service, false]));
    for (const spec of specsOf(root, directory, allRoots)) {
      const specNeed = specNeedsOf(root, spec);
      for (const service of SERVICES) needs[service] ||= specNeed[service];
    }
    return {project, ...needs};
  });
}

function specNeedsOf(root, spec) {
  return specNeeds(fs.readFileSync(path.join(root, spec), "utf8"));
}

if (process.argv[1] && path.resolve(process.argv[1]) == fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const projects = JSON.parse(process.argv[2] || "[]");
  console.log(JSON.stringify(buildMatrix(root, projects)));
}
