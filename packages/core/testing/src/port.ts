import net from "net";

export function getFreePort(host = "0.0.0.0"): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const {port} = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

export async function getFreeAddress(host = "0.0.0.0"): Promise<string> {
  return `${host}:${await getFreePort(host)}`;
}
