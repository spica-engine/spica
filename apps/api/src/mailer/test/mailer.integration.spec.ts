import {Test, TestingModule} from "@nestjs/testing";
import {MailerModule} from "../index";
import {MailerService} from "../index";
import fetch from "node-fetch";
import {GenericContainer} from "testcontainers";

describe("MailerService Integration", () => {
  let module: TestingModule;
  let service: MailerService;
  let container: any;
  let smtpPort: number;
  let apiPort: number;
  let apiHost: string;

  beforeAll(async () => {
    const mailerUrl = process.env.MAILER_URL;
    let smtpHost = "localhost";
    apiHost = "localhost";

    if (mailerUrl) {
      const [smtpUrl, apiUrl] = mailerUrl.split(",");
      const smtpParts = smtpUrl.split("://")[1].split(":");
      const apiParts = apiUrl.split("://")[1].split(":");

      smtpHost = smtpParts[0];
      smtpPort = parseInt(smtpParts[1]);
      apiHost = apiParts[0];
      apiPort = parseInt(apiParts[1]);
    } else {
      try {
        container = await new GenericContainer("mailhog/mailhog")
          .withExposedPorts(1025, 8025)
          .start();
        smtpPort = container.getMappedPort(1025);
        apiPort = container.getMappedPort(8025);
      } catch (e) {
        console.error(e);
      }
    }

    const options = {
      host: smtpHost,
      port: smtpPort,
      secure: false,
      defaults: {from: process.env.TEST_MAIL_FROM || "integration@example.com"}
    } as any;

    module = await Test.createTestingModule({
      imports: [MailerModule.forRoot(options)]
    }).compile();

    service = module.get<MailerService>(MailerService);
  }, 60000);

  afterAll(async () => {
    if (module) await module.close();
    if (container) await container.stop();
  });

  it("sends a real SMTP message and MailHog receives it", async () => {
    await service.sendMail({
      to: "recipient@example.com",
      subject: "Integration Test",
      text: "Hello from integration test"
    } as any);

    // wait a moment for MailHog to receive
    await new Promise(r => setTimeout(r, 500));

    const resp = await fetch(`http://${apiHost}:${apiPort}/api/v2/messages`);
    const body: any = await resp.json();

    expect(body.total).toBeGreaterThan(0);
    const item: any = body.items[0];
    expect(item).toBeDefined();

    // MailHog may return headers under different keys (Content.Headers or Raw.Headers)
    const headers = (item.Content && item.Content.Headers) || (item.Raw && item.Raw.Headers) || {};

    const findHeader = (obj: any, keys: string[]) => {
      for (const k of keys) {
        if (obj[k]) return obj[k];
      }
      return undefined;
    };

    const subjectHeader = findHeader(headers, ["Subject", "subject"]);
    const toHeader = findHeader(headers, ["To", "to"]);
    const raw =
      item.Raw && item.Raw.Data
        ? item.Raw.Data
        : item.Content && item.Content.Body
          ? item.Content.Body
          : "";

    // Normalize an extracted object and assert it in a single expect for readability.
    const extracted = {
      to: toHeader ? String(toHeader[0]) : String(raw || ""),
      subject: subjectHeader ? String(subjectHeader[0]) : String(raw || ""),
      text: String(item.Content?.Body || raw || "")
    };

    const expected = {
      to: "recipient@example.com",
      subject: "Integration Test",
      text: "Hello from integration test"
    };

    expect(extracted).toEqual(expected);
  }, 20000);
});
