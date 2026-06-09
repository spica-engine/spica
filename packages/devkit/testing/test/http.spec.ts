import {api, HttpClient} from "../src/http";

function recordingClient(): {http: HttpClient; posts: Array<{url: string; body: any}>; puts: string[]} {
  const posts: Array<{url: string; body: any}> = [];
  const puts: string[] = [];
  const http = {
    get: async () => [] as any, // no existing policies
    head: async () => ({}) as any,
    delete: async () => ({}) as any,
    patch: async () => ({}) as any,
    put: async (url: string) => {
      puts.push(url);
      return {} as any;
    },
    post: async (url: string, body?: any) => {
      posts.push({url, body});
      return {_id: "key-id", name: body?.name, key: body?.key ?? "server-generated"} as any;
    }
  } as HttpClient;
  return {http, posts, puts};
}

describe("api.createApiKey", () => {
  it("sends a caller-provided key so a specific api key can be provisioned", async () => {
    const {http, posts} = recordingClient();
    const res = await api.createApiKey(http, "fn-secret", {key: "c64t17lc974dts", fullAccess: false});
    expect(posts[0]).toEqual({
      url: "passport/apikey",
      body: {name: "fn-secret", active: true, key: "c64t17lc974dts"}
    });
    expect(res.key).toBe("c64t17lc974dts");
  });

  it("omits the key when none is given so the server generates one", async () => {
    const {http, posts} = recordingClient();
    const res = await api.createApiKey(http, "auto", {fullAccess: false});
    expect(posts[0].body).toEqual({name: "auto", active: true});
    expect("key" in posts[0].body).toBe(false);
    expect(res.key).toBe("server-generated");
  });

  it("attaches explicit policies to the created key", async () => {
    const {http, puts} = recordingClient();
    await api.createApiKey(http, "scoped", {fullAccess: false, policies: ["p1", "p2"]});
    expect(puts).toEqual(
      expect.arrayContaining(["passport/apikey/key-id/policy/p1", "passport/apikey/key-id/policy/p2"])
    );
  });
});
