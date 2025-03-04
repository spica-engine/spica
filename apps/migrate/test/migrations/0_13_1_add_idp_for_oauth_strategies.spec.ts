import {Db, getConnectionUri, getDatabaseName, start} from "@spica-server/database/testing";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/apps/migrate/src");

describe("Add index to names of objects with the same name", () => {
  let db: Db;
  let args: string[];

  const oauthStrategy = {
    type: "oauth",
    name: "oauth",
    title: "oauth",
    icon: "login",
    options: {
      code: {
        base_url: "/oauth/code",
        params: {
          client_id: "client_id"
        },
        headers: {},
        method: "get"
      },
      access_token: {
        base_url: "/oauth/token",
        params: {
          client_id: "client_id",
          client_secret: "client_secret"
        },
        headers: {},
        method: "get"
      },
      identifier: {
        base_url: "/oauth/info",
        params: {},
        headers: {},
        method: "get"
      }
    }
  };

  const samlStrategy = {
    type: "saml",
    name: "strategy1",
    title: "strategy1",
    options: {
      ip: {
        login_url: "/idp/login",
        logout_url: "/idp/logout",
        certificate: "CERTIFICATE"
      }
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

  it("should add custom idp to ouath strategies", async () => {
    await run([...args, "--from", "0.13.0", "--to", "0.13.1", "--continue-if-versions-are-equal"]);
    const storage = await db.collection("strategy").find().toArray();

    expect(storage).toEqual([
      {...oauthStrategy, options: {...oauthStrategy.options, idp: "custom"}},
      samlStrategy
    ]);
  });
});
