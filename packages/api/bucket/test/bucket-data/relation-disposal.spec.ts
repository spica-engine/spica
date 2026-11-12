import {contractSuite} from "@spica-server/database-testing";
import {BucketApp, startBucketApp, withoutNulls} from "../support/bucket-app";
import {idOf} from "@spica-server/data";

contractSuite("BucketDataController: relation disposal", engine => {
  let api: BucketApp;
  let key: string;

  beforeEach(async () => {
    api = await startBucketApp(engine);
    key = api.keyField;
  });

  afterEach(() => api.close());

  const bucketOf = async (title: string, properties: Record<string, unknown>) =>
    idOf(await api.createBucket(properties, {title, description: title})) as string;

  describe("clear relations", () => {
    let userBucket: string;
    let ticketBucket: string;
    let hallBucket: string;

    beforeEach(async () => {
      hallBucket = await bucketOf("Halls", {title: {type: "string", title: "name"}});
      ticketBucket = await bucketOf("Ticket", {
        place: {
          type: "object",
          properties: {
            hall: {type: "relation", bucketId: hallBucket, relationType: "onetoone"},
            seat_number: {type: "number"}
          }
        }
      });
      userBucket = await bucketOf("Users", {
        name: {type: "string", title: "name"},
        tickets: {type: "relation", bucketId: ticketBucket, relationType: "onetomany"}
      });
    });

    it("should remove tickets from users when deleted", async () => {
      const {body: firstTicket} = await api.req.post(`/bucket/${ticketBucket}/data`, {});
      const {body: secondTicket} = await api.req.post(`/bucket/${ticketBucket}/data`, {});

      await api.req.post(`/bucket/${userBucket}/data`, {
        name: "first",
        tickets: [firstTicket[key]]
      });
      await api.req.post(`/bucket/${userBucket}/data`, {
        name: "second",
        tickets: [firstTicket[key], secondTicket[key]]
      });

      await api.req.delete(`/bucket/${ticketBucket}/data/${firstTicket[key]}`);

      const {body: users} = await api.req.get(`/bucket/${userBucket}/data`);

      expect(users).toEqual([
        {[key]: users[0][key], name: "first", tickets: []},
        {[key]: users[1][key], name: "second", tickets: [secondTicket[key]]}
      ]);
    });

    it("should remove halls from ticket when deleted", async () => {
      const {body: firstHall} = await api.req.post(`/bucket/${hallBucket}/data`, {
        title: "first hall"
      });

      await api.req.post(`/bucket/${ticketBucket}/data`, {
        place: {hall: firstHall[key], seat_number: 1}
      });
      await api.req.post(`/bucket/${ticketBucket}/data`, {
        place: {hall: firstHall[key], seat_number: 2}
      });

      await api.req.delete(`/bucket/${hallBucket}/data/${firstHall[key]}`);

      const {body: tickets} = await api.req.get(`/bucket/${ticketBucket}/data`);

      expect(withoutNulls(tickets)).toEqual([
        {[key]: tickets[0][key], place: {seat_number: 1}},
        {[key]: tickets[1][key], place: {seat_number: 2}}
      ]);
    });
  });

  describe("dependents", () => {
    let companyBucket: string;
    let employeeBucket: string;
    let addressBucket: string;

    beforeEach(async () => {
      addressBucket = await bucketOf("Address", {
        street: {type: "string"},
        city: {type: "string"}
      });
      employeeBucket = await bucketOf("Employee", {
        fullname: {type: "string"},
        address: {
          type: "relation",
          relationType: "onetoone",
          bucketId: addressBucket,
          dependent: true
        }
      });
      companyBucket = await bucketOf("Company", {
        name: {type: "string"},
        employees: {
          type: "relation",
          relationType: "onetomany",
          bucketId: employeeBucket,
          dependent: true
        }
      });
    });

    it("should remove employees and their addresses when company deleted", async () => {
      const {body: address1} = await api.req.post(`/bucket/${addressBucket}/data`, {
        street: "1235",
        city: "Tallinn"
      });
      const {body: address2} = await api.req.post(`/bucket/${addressBucket}/data`, {
        street: "3457",
        city: "Stockholm"
      });

      const {body: employee1} = await api.req.post(`/bucket/${employeeBucket}/data`, {
        fullname: "Stefanos Ardit",
        address: address1[key]
      });
      const {body: employee2} = await api.req.post(`/bucket/${employeeBucket}/data`, {
        fullname: "Emil Hanna",
        address: address2[key]
      });

      const {body: company} = await api.req.post(`/bucket/${companyBucket}/data`, {
        name: "Frostfire Corp",
        employees: [employee1[key], employee2[key]]
      });

      const deleteResponse = await api.req.delete(`/bucket/${companyBucket}/data/${company[key]}`);
      expect([deleteResponse.statusCode, deleteResponse.statusText, deleteResponse.body]).toEqual([
        204,
        "No Content",
        undefined
      ]);

      expect((await api.req.get(`/bucket/${companyBucket}/data`)).body).toEqual([]);
      expect((await api.req.get(`/bucket/${employeeBucket}/data`)).body).toEqual([]);
      expect((await api.req.get(`/bucket/${addressBucket}/data`)).body).toEqual([]);
    });
  });
});
