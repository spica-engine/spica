import {Test, TestingModule} from "@nestjs/testing";
import {MailerService} from "../index";
import {MailerModule} from "../index";
import {MailerOptions} from "@spica-server/interface/mailer";
import nodemailer from "nodemailer";

describe("MailerService", () => {
  let service: MailerService;
  let module: TestingModule;

  const mockOptions: MailerOptions = {
    host: "smtp.test.com",
    port: 587,
    secure: false,
    auth: {
      user: "test@example.com",
      pass: "password"
    },
    defaults: {
      from: "noreply@example.com"
    }
  };

  const sendMailMock = jest.fn();
  let createTransportSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Mock createTransport before the module is compiled so MailerService constructor
    // uses the mocked transport.
    createTransportSpy = jest
      .spyOn(nodemailer, "createTransport")
      .mockImplementation((opts: any) => {
        // record the options via the spy; return an object with sendMail
        return {sendMail: sendMailMock} as any;
      });

    module = await Test.createTestingModule({
      imports: [MailerModule.forRoot(mockOptions)]
    }).compile();

    service = module.get<MailerService>(MailerService);
  });

  afterEach(async () => {
    createTransportSpy.mockRestore();
    sendMailMock.mockReset();
    if (module) {
      await module.close();
    }
  });

  it("should be defined and configured", () => {
    const actual = {
      options: service["options"],
      transport: createTransportSpy.mock.calls[0][0]
    };

    const expected = {
      options: mockOptions,
      transport: {
        host: mockOptions.host,
        port: mockOptions.port,
        secure: !!mockOptions.secure,
        auth: mockOptions.auth
      }
    };

    expect(actual).toEqual(expected);
  });

  it("should send mail and return result", async () => {
    const result = {messageId: "abc123"};
    sendMailMock.mockResolvedValue(result);

    const mail = {to: "user@example.com", subject: "Hi", text: "hello"};
    const res = await service.sendMail(mail as any);

    const sentArg = sendMailMock.mock.calls[0][0];
    expect({sent: sentArg, res}).toEqual({
      sent: {
        from: mockOptions.defaults?.from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: undefined
      },
      res: result
    });
  });

  it("should propagate transporter errors", async () => {
    sendMailMock.mockRejectedValue(new Error("transport-failure"));
    try {
      await service.sendMail({to: "x@x.com", subject: "err"} as any);
      // If no error thrown, fail the test
      throw new Error("Expected transporter to throw");
    } catch (e: any) {
      expect({message: e.message, calls: sendMailMock.mock.calls.length}).toEqual({
        message: "transport-failure",
        calls: 1
      });
    }
  });
});
