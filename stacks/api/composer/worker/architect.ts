import {Architect, Target, BuilderRun} from "@angular-devkit/architect";
import {WorkspaceNodeModulesArchitectHost} from "@angular-devkit/architect/node";
import {experimental, normalize, json} from "@angular-devkit/core";
import {createConsoleLogger, NodeJsSyncHost} from "@angular-devkit/core/node";
import * as url from "url";

let registry: json.schema.CoreSchemaRegistry;
let host: WorkspaceNodeModulesArchitectHost;
let workspace: experimental.workspace.Workspace;
let architect: Architect;

async function load(root: string) {
  workspace = await new experimental.workspace.Workspace(normalize(root), new NodeJsSyncHost())
    .loadWorkspaceFromHost(normalize("angular.json"))
    .toPromise();
  host = new WorkspaceNodeModulesArchitectHost(workspace, workspace.root);
  registry = new json.schema.CoreSchemaRegistry();
  registry.addPreTransform(json.schema.transforms.addUndefinedDefaults);
  architect = new Architect(host, registry);
}

let run: BuilderRun;

async function serve(root: string, publicHost: string) {
  if (!workspace) {
    await load(root);
  }

  publicHost = `${publicHost}/composer/viewport`;

  if (run) {
    console.log(run.result);
    return process.send({
      state: "stopped",
      url: publicHost
    });
  }

  const target: Target = {
    project: workspace.getDefaultProjectName(),
    target: "serve",
    configuration: undefined
  };

  const parsedUrl = url.parse(publicHost);
  run = await architect.scheduleTarget(
    target,
    {
      port: 4500,
      sourceMap: false,
      hmr: true,
      disableHostCheck: true,
      publicHost,
      baseHref: parsedUrl.pathname.endsWith("/") ? parsedUrl.pathname : `${parsedUrl.pathname}/`
    },
    {logger: createConsoleLogger()}
  );

  run.progress.subscribe({
    next: event => {
      const payload: any = {state: event.state, status: event.status};
      if (event.total && event.current) {
        payload.progress = (100 / event.total) * event.current;
      }
      if (event.state == "stopped") {
        payload.url = publicHost;
      }
      process.send(payload);
    }
  });
}

process.on("message", message => {
  switch (message.type) {
    case "serve":
      serve(message.root, message.publicHost);
      break;
  }
});
