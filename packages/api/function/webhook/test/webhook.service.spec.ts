import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {WebhookService, WebhookChangeDispatcher} from "@spica-server/function-webhook";
import {Webhook, ChangeKind} from "@spica-server/interface-function-webhook";
import {bufferCount, bufferTime, take} from "rxjs/operators";

describe("Webhook Service", () => {
  let service: WebhookService;
  let module: TestingModule;
  let webhook: Webhook;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()],
      providers: [WebhookService, WebhookChangeDispatcher]
    }).compile();
    service = module.get(WebhookService);
    jest.restoreAllMocks();

    webhook = {
      title: "wh1",
      url: "http://spica.internal/test",
      body: "",
      trigger: {
        active: true,
        name: "database",
        options: {
          collection: "test",
          type: "INSERT"
        }
      }
    };
  });

  afterEach(async () => await module.close());

  it("should report send target which is not active", done => {
    webhook.trigger.active = false;
    service.insertOne(webhook).then(() =>
      service
        .targets()
        .pipe(bufferTime(1000), take(1))
        .subscribe(targets => {
          expect(targets).toEqual([]);
          done();
        })
    );
  });

  it("should report target which is active", done => {
    service.insertOne(webhook).then(hook =>
      service
        .targets()
        .pipe(take(1))
        .subscribe(targets => {
          expect(targets).toEqual({
            kind: ChangeKind.Added,
            target: hook._id.toHexString(),
            webhook: {
              title: hook.title,
              url: hook.url,
              body: hook.body,
              trigger: hook.trigger
            }
          });
          done();
        })
    );
  });

  it("should report newly added hook", done => {
    let hook;
    service
      .targets()
      .pipe(take(1))
      .subscribe(targets => {
        expect(targets).toEqual({
          kind: ChangeKind.Added,
          target: hook._id.toHexString(),
          webhook: {
            title: hook.title,
            url: hook.url,
            body: hook.body,
            trigger: hook.trigger
          }
        });
        done();
      });
    service.insertOne(webhook).then(_hook => (hook = _hook));
  });

  it("should report removed hook", done => {
    service.insertOne(webhook).then(hook => {
      service
        .targets()
        .pipe(bufferCount(2), take(1))
        .subscribe(targets => {
          expect(targets).toEqual([
            {
              kind: ChangeKind.Added,
              target: hook._id.toHexString(),
              webhook: {
                title: hook.title,
                url: hook.url,
                body: hook.body,
                trigger: hook.trigger
              }
            },
            {
              kind: ChangeKind.Removed,
              target: hook._id.toHexString()
            }
          ]);
          done();
        });

      service.findOneAndDelete({_id: hook._id});
    });
  });

  it("should report hook as removed when deactivated", done => {
    service.insertOne(webhook).then(hook => {
      service
        .targets()
        .pipe(bufferCount(2), take(1))
        .subscribe(targets => {
          expect(targets).toEqual([
            {
              kind: ChangeKind.Added,
              target: hook._id.toHexString(),
              webhook: {
                title: hook.title,
                url: hook.url,
                body: hook.body,
                trigger: hook.trigger
              }
            },
            {
              kind: ChangeKind.Removed,
              target: hook._id.toHexString()
            }
          ]);
          done();
        });
      service.findOneAndReplace(
        {_id: hook._id},
        {...webhook, trigger: {...webhook.trigger, active: false}}
      );
    });
  });

  it("should keep reporting after a reload fails", done => {
    const coll = (service as any)._coll;
    const findOne = coll.findOne.bind(coll);
    let alreadyFailed = false;

    jest.spyOn((service as any).logger, "error").mockImplementation(() => {});
    jest.spyOn(coll, "findOne").mockImplementation((...args) => {
      if (!alreadyFailed) {
        alreadyFailed = true;
        return Promise.reject(new Error("transient failure"));
      }
      return findOne(...args);
    });

    service
      .targets()
      .pipe(take(1))
      .subscribe(target => {
        expect(target.kind).toEqual(ChangeKind.Added);
        expect(target.webhook.title).toBe("wh2");
        done();
      });

    // insertOne stamps _id onto the given document, so build the second one up front
    const second = {...webhook, title: "wh2"};

    service
      .insertOne(webhook)
      .then(() => service.insertOne(second))
      .catch();
  });
});
