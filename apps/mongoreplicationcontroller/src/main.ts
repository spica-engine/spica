import * as cp from "child_process";
import * as dns from "dns";
import * as os from "os";
import * as util from "util";
import * as yargs from "yargs";

const options = yargs
  .option("from-srv", {
    type: "boolean",
    default: true,
    describe: "All available nodes will be discovered from SRV records."
  })
  .option("replica-set", {
    type: "string",
    default: "rs0",
    describe: "Name of the replica-set",
    demand: true
  })
  .option("bypass-quorum-check", {
    type: "boolean",
    default: true,
    describe:
      "When true, the unready nodes will be added to replication by bypassing the mongodb quorum check."
  })
  .option("hostname", {
    type: "string",
    default: os.hostname(),
    demand: true
  })
  .option("nodes", {
    type: "array",
    describe: "Addresses of available nodes"
  })
  .option("max-retry-connection", {
    type: "number",
    default: 5,
    demand: true
  })
  .option("wait-before-retry", {
    type: "number",
    describe: "Amount of time in seconds that should be awaited before retrying the connection",
    default: 3,
    demand: true
  })
  .option("debug", {
    type: "boolean",
    default: false
  })
  .parse();

const exec = util.promisify(cp.exec);
const lookup = util.promisify(dns.lookup);
const lookupService = util.promisify(dns.lookupService);
const resolveSrv = util.promisify(dns.resolveSrv);

function debug(message: string) {
  options["debug"] && console.debug(`${new Date().toISOString()}  ${message}`);
}

async function findPrimaryNode(nodes: string[]) {
  for (const node of nodes) {
    try {
      const {stdout} = await exec(`mongosh admin --host "${node}" --eval "rs.isMaster()"`);
      debug(stdout);
      if (stdout.indexOf('"ismaster" : true') > -1) {
        return node;
      }
    } catch (error) {
      const out = error.stderr + error.stdout + "";
      if (out.indexOf("connection attempt failed") != -1) {
        debug(`Searching for primary node: ${node} is offline.`);
      } else {
        throw error;
      }
    }
  }
  return null;
}

async function initiateReplication(nodes: string[], reinitiate = false) {
  const {stdout} = await exec(`mongosh --host "${nodes[0]}" --eval "rs.status()"`);
  if (stdout.indexOf("no replset config has been received") > -1) {
    const {stdout} = await exec(
      `mongosh --host ${nodes[0]} --eval 'rs.initiate({"_id": "${options["replica-set"]}", "members": ${JSON.stringify(nodes.map((host, _id) => ({_id, host})))}})'`
    );
    debug(stdout);
    if (stdout.indexOf('"ok" : 1') == -1) {
      throw new Error("Can not initialize replica set.");
    }
  } else if (reinitiate) {
    debug("Replication has been initialized already. Re-initiating it.");
    let primary = await findPrimaryNode(nodes);
    if (primary) {
      debug(`Re-initiate: Found the primary node ${primary}`);
    } else {
      debug(`Could not find the primary node; using the first node instead.`);
      primary = nodes[0];
    }

    const script = [
      "cfg = rs.conf()",
      `cfg.members = ${JSON.stringify(nodes.map((host, _id) => ({_id, host})))}`,
      "rs.reconfig(cfg, { force: true })"
    ];
    const {stdout} = await exec(`mongosh admin --host "${primary}" --eval '${script.join(";")}'`);
    debug(stdout);
    if (stdout.indexOf('"ok" : 1') == -1) {
      throw new Error("Can not initialize replica set.");
    }
  }
}

async function addAsSecondary(primaryHost: string, secondaryHost: string, index: number) {
  const {stdout} = await exec(`mongosh admin --host "${primaryHost}" --eval "rs.config()"`);
  debug(stdout);

  if (stdout.indexOf(secondaryHost) == -1) {
    const conf = [
      "cfg = rs.conf()",
      `cfg.members[${index}] = { _id: ${index},  host: "${secondaryHost}"}`,
      "rs.reconfig(cfg, { force: true })"
    ];
    const {stdout} = await exec(`mongosh admin --host "${primaryHost}" --eval '${conf.join(";")}'`);
    debug(stdout);
    if (stdout.indexOf('"ok" : 1') == -1) {
      throw new Error(`Can not add the secondary node ${secondaryHost}`);
    }
  }
}

async function initialize() {
  if (options["from-srv"]) {
    debug("Server discovery is in action.");
    debug(`POD Hostname is: ${options["hostname"]}`);

    const ip = await lookup(options["hostname"], {family: 4, hints: dns.ADDRCONFIG});

    debug(`Hostname is resolved to ${ip.address}, family: ${ip.family}`);

    // Headless service domain name
    // Checkout: https://en.wikipedia.org/wiki/Fully_qualified_domain_name
    const domainName = await lookupService(ip.address, 0);

    if (!domainName) {
      throw new Error("Failed to lookup service.");
    }

    const namespace = domainName.hostname.slice(options["hostname"].length + 1);

    debug(`Namespace: ${namespace}`);

    const nodes = (
      await resolveSrv(namespace).catch((error: NodeJS.ErrnoException) => {
        if (error.code == dns.NOTFOUND || error.code == dns.NODATA) {
          debug("Can not reach to other nodes.");
        } else {
          return Promise.reject(error);
        }
      })
    )?.map(node => node.name);

    if (nodes) {
      if (nodes.length > 1) {
        // Wait some for another node to become primary.
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
      let primary = await findPrimaryNode(nodes);
      if (!primary) {
        if (nodes.length == 1) {
          debug(
            "There is only one node and it is either inaccessible or secondary. Skipping the initialization."
          );
        } else {
          debug("Theres no primary, initializing the replica set.");
          await initiateReplication([nodes[0]]);
          primary = nodes[0];
          await addAsSecondary(primary, domainName.hostname, nodes.length);
        }
      }
    }
  } else {
    const nodes = options["nodes"];
    debug("Initializing replication from --nodes");
    debug(`Nodes: ${nodes.join(", ")}`);

    let success = false;
    for (let retry = 0; retry < options["max-retry-connection"]; retry++) {
      try {
        await initiateReplication(nodes.map(String), true /* Reinitiate if necessary */);
        success = true;
        break;
      } catch (error) {
        const stdout: string = error.stdout || "";
        if (stdout.indexOf("connection attempt failed") == -1) {
          // If the error is not a connection error then re-throw the error
          throw error;
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000 * options["wait-before-retry"]));
        }
      }
    }

    if (success) {
      debug("Initiating the replication has been successful.");
    } else {
      debug(
        `All attempts (${options["max-retry-connection"]}) to initiate the replication have failed.`
      );
      throw new Error(`Could not connect to first node ${nodes[0]}.`);
    }
  }
}

initialize().catch(error => {
  console.error("Attempt to initialize replication has failed.");
  console.error(error);
  process.exit(1);
});
