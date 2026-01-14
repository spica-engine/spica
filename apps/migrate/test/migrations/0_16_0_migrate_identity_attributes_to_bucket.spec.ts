import {
  Db,
  getConnectionUri,
  getDatabaseName,
  ObjectId,
  start
} from "@spica-server/database/testing";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/apps/migrate/src");

describe("Migrate identity attributes to bucket", () => {
  let db: Db;
  let args: string[];

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    const connection = await start("replset");
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);

    await db.collection("preferences").insertOne({
      scope: "passport",
      identity: {
        schema: {
          attributes: {
            email: {
              type: "string",
              title: "Email",
              description: "User email address"
            },
            role: {
              type: "string",
              title: "Role",
              description: "User role"
            },
            phone: {
              type: "string",
              title: "Phone",
              description: "User phone number"
            },
            department: {
              type: "string",
              title: "Department",
              description: "User department"
            }
          }
        }
      }
    });

    await db.collection("identity").insertMany([
      {
        identifier: "user1",
        password: "hashed_password_1",
        policies: [],
        attributes: {
          email: "user1@example.com",
          role: "admin",
          phone: "123-456-7890"
        }
      },
      {
        identifier: "user2",
        password: "hashed_password_2",
        policies: [],
        attributes: {
          email: "user2@example.com",
          role: "user"
        }
      },
      {
        identifier: "user3",
        password: "hashed_password_3",
        policies: []
        // No attributes
      },
      {
        identifier: "user4",
        password: "hashed_password_4",
        policies: [],
        attributes: {
          email: "user4@example.com",
          department: "engineering"
        }
      }
    ]);
  });

  it("should create attributes bucket and migrate identity attributes", async () => {
    await run([...args, "--from", "0.15.0", "--to", "0.16.0", "--continue-if-versions-are-equal"]);

    const buckets = await db.collection("buckets").find({title: "Attributes"}).toArray();
    expect(buckets.length).toBe(1);

    const bucket = buckets[0];
    expect(bucket.title).toBe("Attributes");
    expect(bucket.description).toBe("Migrated identity attributes");
    expect(bucket.primary).toBe("auth_name");

    expect(bucket.properties.auth_name).toEqual({
      type: "string",
      title: "Auth Name",
      description: "Identity identifier reference"
    });
    expect(bucket.properties.email).toEqual({
      type: "string",
      title: "Email",
      description: "User email address"
    });
    expect(bucket.properties.role).toEqual({
      type: "string",
      title: "Role",
      description: "User role"
    });
    expect(bucket.properties.phone).toEqual({
      type: "string",
      title: "Phone",
      description: "User phone number"
    });
    expect(bucket.properties.department).toEqual({
      type: "string",
      title: "Department",
      description: "User department"
    });

    const bucketData = await db.collection(`bucket_${bucket._id}`).find({}).toArray();

    expect(bucketData.length).toBe(3);

    const user3Data = bucketData.find(d => d.auth_name === "user3");
    expect(user3Data).toBeUndefined();

    const user1Data = bucketData.find(d => d.auth_name === "user1");
    expect(user1Data).toEqual({
      _id: expect.any(ObjectId),
      auth_name: "user1",
      email: "user1@example.com",
      role: "admin",
      phone: "123-456-7890"
    });

    const user2Data = bucketData.find(d => d.auth_name === "user2");
    expect(user2Data).toEqual({
      _id: expect.any(ObjectId),
      auth_name: "user2",
      email: "user2@example.com",
      role: "user"
    });

    const user4Data = bucketData.find(d => d.auth_name === "user4");
    expect(user4Data).toEqual({
      _id: expect.any(ObjectId),
      auth_name: "user4",
      email: "user4@example.com",
      department: "engineering"
    });

    const identities = await db.collection("identity").find({}).toArray();
    identities.forEach(identity => {
      expect(identity.attributes).toBeUndefined();
    });
    expect(identities.length).toBe(4);
  });
});
