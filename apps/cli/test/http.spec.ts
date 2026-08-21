import {httpService} from "@spica/cli/src/http";

function clientRejectingWith(rejection: unknown) {
  const client = httpService.create({
    baseUrl: "http://localhost",
    authorization: "APIKEY test"
  }) as any;
  client.defaults.adapter = () => Promise.reject(rejection);
  return client;
}

describe("httpService", () => {
  // The rejected error is the only thing callers get to inspect; dropping the
  // status made it impossible to tell a 404 apart from a throttled request.
  it("keeps the response status on the rejected error", async () => {
    const client = clientRejectingWith(
      Object.assign(new Error("Request failed"), {
        response: {status: 404, data: {message: "Not Found"}}
      })
    );

    const error = await client.get("function/fn1/index").catch(e => e);
    expect(error.message).toBe("Not Found");
    expect(error.status).toBe(404);
  });

  it("keeps the axios error code on the rejected error", async () => {
    const client = clientRejectingWith(
      Object.assign(new Error("Request failed"), {
        code: "ECONNABORTED",
        response: {status: 503, data: "Service Unavailable"}
      })
    );

    const error = await client.get("function").catch(e => e);
    expect(error.status).toBe(503);
    expect(error.code).toBe("ECONNABORTED");
  });

  it("annotates an error body that is already an Error without overwriting its status", async () => {
    const alreadyStatused = Object.assign(new Error("Gone"), {status: 410});
    const client = clientRejectingWith(
      Object.assign(new Error("Request failed"), {
        response: {status: 500, data: alreadyStatused}
      })
    );

    const error = await client.get("function").catch(e => e);
    expect(error).toBe(alreadyStatused);
    expect(error.status).toBe(410);
  });

  it("rejects with the original error when there is no response", async () => {
    const networkError = Object.assign(new Error("connect ECONNREFUSED"), {code: "ECONNREFUSED"});
    const client = clientRejectingWith(networkError);

    const error = await client.get("function").catch(e => e);
    expect(error).toBe(networkError);
  });
});
