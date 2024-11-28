import {Command, CreateCommandParameters} from "@caporal/core";
import * as docker from "dockerode";
import * as duration from "pretty-ms";

async function list() {
  const machine = new docker();

  const foundNetworks: docker.NetworkInspectInfo[] = await machine.listNetworks({
    filters: JSON.stringify({label: {namespace: true}})
  });

  const instances = [];

  for (const network of foundNetworks) {
    const containers = await machine.listContainers({
      all: true,
      filters: JSON.stringify({label: [`namespace=${network["Labels"].namespace}`]})
    });

    const namespace = network["Labels"].namespace;

    const instance: any = {
      NAMESPACE: namespace,
      DESCRIPTION: [],
      PORT: "-",
      AGE: "-",
      VERSION: "-",
      STATUS: "-"
    };

    instances.push(instance);

    const api = containers.find(container =>
      container.Names.some(name => name.indexOf(`${namespace}-api`) != -1)
    );
    const spica = containers.find(container =>
      container.Names.some(name => name.indexOf(`${namespace}-spica`) != -1)
    );
    const ingress = containers.find(container =>
      container.Names.some(name => name.indexOf(`${namespace}-ingress`) != -1)
    );

    if (api && spica && ingress) {
      instance.VERSION = api.Image.split(":")[1];
      instance.AGE = duration(new Date(api.Created * 1000).getTime());

      if (ingress.State == "running" && ingress.Ports.length) {
        const [port] = ingress.Ports;
        instance.PORT = `${port.IP}:${port.PublicPort}`;
      }

      if (api.State == "running" && spica.State == "running" && ingress.State == "running") {
        instance.STATE = ingress.State;
        instance.STATUS = ingress.Status;
      } else {
        const downContainer =
          ingress.State != "running" ? ingress : api.State != "running" ? api : spica;
        instance.STATUS = downContainer.Status;
        instance.DESCRIPTION.push(
          `The container ${
            downContainer.Image.startsWith("nginx") ? "Ingress" : downContainer.Names[0].slice(1)
          } is down.`
        );
      }
    }

    const databaseContainers = containers.filter(container => container.Image.startsWith("mongo"));

    const runningDatabaseContainers = containers.filter(
      container => container.Image.startsWith("mongo") && container.State == "running"
    );

    if (runningDatabaseContainers.length != databaseContainers.length) {
      instance.DESCRIPTION.push(`Some database containers are down.`);
    }
  }

  console.table(instances, ["NAMESPACE", "AGE", "STATUS", "VERSION", "PORT", "DESCRIPTION"]);
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("List local projects.")
    .default()
    .action(list);
}
