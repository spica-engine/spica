import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {SchemaModule} from "@spica-server/core/schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {DATE_TIME, OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

describe("BucketDataController", () => {
  let app: INestApplication;
  let req: Request;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, DATE_TIME, OBJECTID_STRING],
          defaults: [CREATED_AT, UPDATED_AT]
        }),
        CoreTestingModule,
        PassportTestingModule.initialize(),
        DatabaseTestingModule.standalone(),
        PreferenceTestingModule,
        BucketModule.forRoot({
          hooks: false,
          history: false,
          realtime: false,
          cache: false,
          graphql: false
        })
      ]
    }).compile();
    app = module.createNestApplication();
    req = module.get(Request);
    req.reject = true; /* Reject for non 2xx response codes */
    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  describe("relation disposal", () => {
    describe("clear relations", () => {
      let userBucket: string;
      let ticketBucket: string;
      let hallBucket: string;
      beforeEach(async () => {
        hallBucket = await req
          .post("/bucket", {
            title: "Halls",
            description: "Halls",
            properties: {
              title: {
                type: "string",
                title: "name"
              }
            }
          })
          .then(r => r.body._id);

        ticketBucket = await req
          .post("/bucket", {
            title: "Ticket",
            description: "Ticket",
            properties: {
              place: {
                type: "object",
                properties: {
                  hall: {
                    type: "relation",
                    bucketId: hallBucket,
                    relationType: "onetoone"
                  },
                  seat_number: {
                    type: "number"
                  }
                }
              }
            }
          })
          .then(r => r.body._id);

        userBucket = await req
          .post("/bucket", {
            title: "Users",
            description: "Users",
            properties: {
              name: {
                type: "string",
                title: "name"
              },
              tickets: {
                type: "relation",
                bucketId: ticketBucket,
                relationType: "onetomany"
              }
            }
          })

          .then(r => r.body._id);
      });

      it("should remove tickets from users when deleted", async () => {
        const {body: firstTicket} = await req.post(`/bucket/${ticketBucket}/data`, {});
        const {body: secondTicket} = await req.post(`/bucket/${ticketBucket}/data`, {});
        await req.post(`/bucket/${userBucket}/data`, {name: "first", tickets: [firstTicket._id]});
        await req.post(`/bucket/${userBucket}/data`, {
          name: "second",
          tickets: [firstTicket._id, secondTicket._id]
        });
        await req.delete(`/bucket/${ticketBucket}/data/${firstTicket._id}`);

        let {body: users} = await req.get(`/bucket/${userBucket}/data`);

        expect(users).toEqual([
          {
            _id: users[0]._id,
            name: "first",
            tickets: []
          },
          {
            _id: users[1]._id,
            name: "second",
            tickets: [secondTicket._id]
          }
        ]);
      });

      it("should remove halls from ticket when deleted", async () => {
        const {body: firstHall} = await req.post(`/bucket/${hallBucket}/data`, {
          title: "first hall"
        });

        await req.post(`/bucket/${ticketBucket}/data`, {
          place: {
            hall: firstHall._id,
            seat_number: 1
          }
        });

        await req.post(`/bucket/${ticketBucket}/data`, {
          place: {
            hall: firstHall._id,
            seat_number: 2
          }
        });

        await req.delete(`/bucket/${hallBucket}/data/${firstHall._id}`);

        const {body: tickets} = await req.get(`/bucket/${ticketBucket}/data`);

        expect(tickets).toEqual([
          {
            _id: tickets[0]._id,
            place: {seat_number: 1}
          },
          {
            _id: tickets[1]._id,
            place: {seat_number: 2}
          }
        ]);
      });
    });

    describe("dependents", () => {
      let companyBucket: string;
      let employeeBucket: string;
      let addressBucket: string;

      beforeEach(async () => {
        addressBucket = await req
          .post("/bucket", {
            title: "Address",
            description: "Address",
            properties: {
              street: {
                type: "string"
              },
              city: {
                type: "string"
              }
            }
          })
          .then(r => r.body._id);

        employeeBucket = await req
          .post("/bucket", {
            title: "Employee",
            description: "Employee",
            properties: {
              fullname: {
                type: "string"
              },
              address: {
                type: "relation",
                relationType: "onetoone",
                bucketId: addressBucket,
                dependent: true
              }
            }
          })
          .then(r => r.body._id);

        companyBucket = await req
          .post("/bucket", {
            title: "Company",
            description: "Company",
            properties: {
              name: {
                type: "string"
              },
              employees: {
                type: "relation",
                relationType: "onetomany",
                bucketId: employeeBucket,
                dependent: true
              }
            }
          })

          .then(r => r.body._id);
      });

      it("should remove employees and their addresses when company deleted", async () => {
        const {body: address1} = await req.post(`/bucket/${addressBucket}/data`, {
          street: "1235",
          city: "Tallinn"
        });
        const {body: address2} = await req.post(`/bucket/${addressBucket}/data`, {
          street: "3457",
          city: "Stockholm"
        });

        const {body: employee1} = await req.post(`/bucket/${employeeBucket}/data`, {
          fullname: "Stefanos Ardit",
          address: address1._id
        });
        const {body: employee2} = await req.post(`/bucket/${employeeBucket}/data`, {
          fullname: "Emil Hanna",
          address: address2._id
        });

        const {body: company} = await req.post(`/bucket/${companyBucket}/data`, {
          name: "Frostfire Corp",
          employees: [employee1._id, employee2._id]
        });

        const deleteResponse = await req.delete(`/bucket/${companyBucket}/data/${company._id}`);

        expect([deleteResponse.statusCode, deleteResponse.statusText, deleteResponse.body]).toEqual(
          [204, "No Content", undefined]
        );

        const {body: companies} = await req.get(`/bucket/${companyBucket}/data`);
        expect(companies).toEqual([]);

        const {body: employees} = await req.get(`/bucket/${employeeBucket}/data`);
        expect(employees).toEqual([]);

        const {body: addresses} = await req.get(`/bucket/${addressBucket}/data`);
        expect(addresses).toEqual([]);
      });
    });
  });
});
