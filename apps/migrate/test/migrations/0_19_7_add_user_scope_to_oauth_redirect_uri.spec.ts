import {Db, getConnectionUri, getDatabaseName, start} from "@spica-server/database-testing";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/src");

jest.setTimeout(120_000);

describe("Add user scope to oauth redirect uri", () => {
  let db: Db;
  let args: string[];

  const publicUrl = "http://localhost:4300";
  const strategyId = "5f30fffd4a51a68d6fec4d3b";
  const previousUri = `${publicUrl}/passport/strategy/${strategyId}/complete`;
  const currentUri = `${publicUrl}/passport/user/strategy/${strategyId}/complete`;

  const oauthStrategy = {
    type: "oauth",
    name: "oauth",
    title: "oauth",
    icon: "login",
    options: {
      idp: "custom",
      code: {
        base_url: "/oauth/code",
        params: {client_id: "client_id", redirect_uri: previousUri},
        headers: {},
        method: "get"
      },
      access_token: {
        base_url: "/oauth/token",
        params: {client_id: "client_id", redirect_uri: previousUri},
        headers: {},
        method: "get"
      },
      identifier: {base_url: "/oauth/info", params: {}, headers: {}, method: "get"}
    }
  };

  const migratedOauthStrategy = {
    type: "oauth",
    name: "oauth",
    title: "oauth",
    icon: "login",
    options: {
      idp: "custom",
      code: {
        base_url: "/oauth/code",
        params: {client_id: "client_id", redirect_uri: currentUri},
        headers: {},
        method: "get"
      },
      access_token: {
        base_url: "/oauth/token",
        params: {client_id: "client_id", redirect_uri: currentUri},
        headers: {},
        method: "get"
      },
      identifier: {base_url: "/oauth/info", params: {}, headers: {}, method: "get"}
    }
  };

  const samlStrategy = {
    type: "saml",
    name: "strategy1",
    title: "strategy1",
    options: {
      ip: {login_url: "/idp/login", logout_url: "/idp/logout", certificate: "CERTIFICATE"}
    }
  };

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    const connection = await start("replset");
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);

    await db.collection("strategy").insertMany([oauthStrategy, samlStrategy]);
  });

  it("should move oauth redirect uris to the user scope", async () => {
    await run([...args, "--from", "0.19.6", "--to", "0.19.7", "--continue-if-versions-are-equal"]);

    const strategies = await db.collection("strategy").find().toArray();

    expect(strategies).toEqual([
      {...migratedOauthStrategy, _id: strategies[0]._id},
      {...samlStrategy, _id: strategies[1]._id}
    ]);
  });
});
