import {Db, getConnectionUri, getDatabaseName, start} from "@spica-server/database-testing";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/src");

jest.setTimeout(120_000);

describe("Add profile scope to google oauth strategies", () => {
  let db: Db;
  let args: string[];

  const strategy = (idp: string, scope: string) => ({
    type: "oauth",
    name: idp,
    title: idp,
    icon: "login",
    options: {
      idp,
      code: {
        base_url: "https://accounts.google.com/o/oauth2/v2/auth",
        params: {client_id: "client_id", response_type: "code", scope},
        headers: {},
        method: "get"
      }
    }
  });

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    const connection = await start("replset");
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);

    await db
      .collection("strategy")
      .insertMany([
        strategy("google", "email"),
        strategy("google", "openid email"),
        strategy("custom", "email")
      ]);
  });

  it("should add profile scope to google strategies that only request email", async () => {
    await run([...args, "--from", "0.19.7", "--to", "0.19.8", "--continue-if-versions-are-equal"]);

    const strategies = await db.collection("strategy").find().toArray();

    expect(strategies).toEqual([
      {...strategy("google", "email profile"), _id: strategies[0]._id},
      {...strategy("google", "openid email"), _id: strategies[1]._id},
      {...strategy("custom", "email"), _id: strategies[2]._id}
    ]);
  });
});
