import * as cp from "child_process";
import * as dns from "dns";
import * as os from "os";
import * as util from "util";

const exec = util.promisify(cp.exec);
const lookup = util.promisify(dns.lookup);
const lookupService = util.promisify(dns.lookupService);
const resolveSrv = util.promisify(dns.resolveSrv);
const podHostname = os.hostname();
console.debug(`POD Hostname is: ${podHostname}`);

async function initialize() {
  const ip = await lookup(podHostname, {family: 4, hints: dns.ADDRCONFIG});

  // Headless service domain name
  // Checkout: https://en.wikipedia.org/wiki/Fully_qualified_domain_name
  const domainName = await lookupService(ip.address, 0);

  if (!domainName) {
    throw new Error("Failed to lookup service.");
  }

  const namespace = domainName.hostname.slice(podHostname.length + 1);

  console.debug(`Namespace: ${namespace}`);

  const nodes = await resolveSrv(namespace).catch((error: NodeJS.ErrnoException) => {
    if (error.code == dns.NOTFOUND || error.code == dns.NODATA) {
      console.log("Can not reach to other nodes.");
    } else {
      return Promise.reject(error);
    }
  });

  if (nodes) {
    let primary = await findPrimaryNode(nodes);
    if (!primary) {
      console.debug("Theres no primary, initializing the replica set.");
      await initiateRepl(nodes[0].name);
      primary = nodes[0];
    }
    await addAsSecondary(primary.name, domainName.hostname, nodes.length, nodes.length == 2);
  }
}

initialize();

async function findPrimaryNode(nodes: dns.SrvRecord[]) {
  if (nodes.length > 1) {
    // Wait some for another node to become primary.
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
  for (const node of nodes) {
    const {stdout} = await exec(`mongo admin --host "${node.name}" --eval "rs.isMaster()"`);
    console.log(stdout);
    if (stdout.indexOf('"ismaster" : true') > -1) {
      return node;
    }
  }
  return null;
}

async function initiateRepl(address: string) {
  const {stdout} = await exec(`mongo --host "${address}" --eval "rs.status()"`);
  if (stdout.indexOf("no replset config has been received") > -1) {
    const {stdout} = await exec(
      `mongo --host "${address}" --eval "rs.initiate({'_id': '${process.env.REPL_SET ||
        "rs0"}', 'members': [{'_id': 0, 'host': '${address}'}]})"`
    );
    console.log(stdout);
    if (stdout.indexOf('"ok" : 1') == -1) {
      throw new Error("Can not initialize replica set.");
    }
  }
}

async function addAsSecondary(
  primaryHost: string,
  secondaryHost: string,
  index: number,
  slaveDelay: boolean = false
) {
  const {stdout} = await exec(`mongo admin --host "${primaryHost}" --eval "rs.config()"`);

  console.log(stdout);
  if (stdout.indexOf(secondaryHost) == -1) {
    const conf = [
      "cfg = rs.conf()",
      `cfg.members[${index}] = { _id: ${index},  host: "${secondaryHost}", slaveDelay: ${
        slaveDelay ? 5 : 0
      }, priority: ${slaveDelay ? 0 : 1} ${slaveDelay ? ', tags: { slaveDelay: "true" }' : ""} }`,
      "rs.reconfig(cfg, { force: true })"
    ];
    const {stdout} = await exec(`mongo admin --host "${primaryHost}" --eval '${conf.join(";")}'`);

    console.log(stdout);
    if (stdout.indexOf('"ok" : 1') == -1) {
      throw new Error(`Can not add the secondary node ${secondaryHost}`);
    }
  }
}
