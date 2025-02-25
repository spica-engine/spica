// import {Db, getConnectionUri, getDatabaseName, start} from "@spica-server/database/testing";
// import color from "cli-color/lib/supports-color";
// import {run} from "@spica/migrate";
// import path from "path";

// process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/apps/migrate/src");

// describe("Set FCV(Feature Compatibility Version) to 5", () => {
//   let db: Db;
//   let args: string[];

//   beforeAll(() => {
//     color.disableColor();
//   });

//   beforeEach(async () => {
//     const connection = await start("replset", "5.0.0");
//     args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
//     db = connection.db(args[3]);
//   });

//   it("should set fcv to 5", async () => {
//     // // since mongo memory server starts fresh instance
//     // // fcv is always the mongo version
//     // // we should manually do this to ensure migration is running on old servers
//     // await db.admin().command({
//     //   setFeatureCompatibilityVersion: "4.4"
//     // });
//     // let fcv = await db
//     //   .admin()
//     //   .command({
//     //     getParameter: 1,
//     //     featureCompatibilityVersion: 1
//     //   })
//     //   .then(r => r.featureCompatibilityVersion.version);
//     // expect(fcv).toEqual("4.4");

//     await run([...args, "--from", "0.10.0", "--to", "0.11.0", "--continue-if-versions-are-equal"]);

//     fcv = await db
//       .admin()
//       .command({
//         getParameter: 1,
//         featureCompatibilityVersion: 1
//       })
//       .then(r => r.featureCompatibilityVersion.version);
//     expect(fcv).toEqual("5.0");
//   });
// });
