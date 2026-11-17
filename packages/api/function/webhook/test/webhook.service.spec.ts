import {provideRepository, idOf} from "@spica-server/data";
import {WEBHOOK_REPOSITORY} from "@spica-server/interface-function-webhook";
import {Test, TestingModule} from "@nestjs/testing";
import {contractSuite} from "@spica-server/database-testing";
import {WebhookService, WebhookChangeDispatcher} from "@spica-server/function-webhook";
import {Webhook, ChangeKind} from "@spica-server/interface-function-webhook";
import {bufferCount, bufferTime, take} from "rxjs/operators";

contractSuite("Webhook Service", engine => {
  let service: WebhookService;
  let webhooks: any;
  let module: TestingModule;
  let webhook: Webhook;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: [provideRepository(WEBHOOK_REPOSITORY), WebhookService, WebhookChangeDispatcher]
    }).compile();
    service = module.get(WebhookService);
    webhooks = module.get(WEBHOOK_REPOSITORY);
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
    service.insert(webhook).then(() =>
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
    service.insert(webhook).then(hook =>
      service
        .targets()
        .pipe(take(1))
        .subscribe(targets => {
          expect(targets).toEqual({
            kind: ChangeKind.Added,
            target: String(idOf(hook)),
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
          target: String(idOf(hook)),
          webhook: {
            title: hook.title,
            url: hook.url,
            body: hook.body,
            trigger: hook.trigger
          }
        });
        done();
      });
    service.insert(webhook).then(_hook => (hook = _hook));
  });

  it("should report removed hook", done => {
    service.insert(webhook).then(hook => {
      service
        .targets()
        .pipe(bufferCount(2), take(1))
        .subscribe(targets => {
          expect(targets).toEqual([
            {
              kind: ChangeKind.Added,
              target: String(idOf(hook)),
              webhook: {
                title: hook.title,
                url: hook.url,
                body: hook.body,
                trigger: hook.trigger
              }
            },
            {
              kind: ChangeKind.Removed,
              target: String(idOf(hook))
            }
          ]);
          done();
        });

      service.deleteById(idOf(hook));
    });
  });

  it("should report hook as removed when deactivated", done => {
    service.insert(webhook).then(hook => {
      service
        .targets()
        .pipe(bufferCount(2), take(1))
        .subscribe(targets => {
          expect(targets).toEqual([
            {
              kind: ChangeKind.Added,
              target: String(idOf(hook)),
              webhook: {
                title: hook.title,
                url: hook.url,
                body: hook.body,
                trigger: hook.trigger
              }
            },
            {
              kind: ChangeKind.Removed,
              target: String(idOf(hook))
            }
          ]);
          done();
        });
      service.replaceById(idOf(hook), {...webhook, trigger: {...webhook.trigger, active: false}});
    });
  });

  it("should keep reporting after a reload fails", done => {
    const findById = webhooks.findById.bind(webhooks);
    let alreadyFailed = false;

    jest.spyOn((service as any).logger, "error").mockImplementation(() => {});
    jest.spyOn(webhooks, "findById").mockImplementation((...args) => {
      if (!alreadyFailed) {
        alreadyFailed = true;
        return Promise.reject(new Error("transient failure"));
      }
      return findById(...args);
    });

    service
      .targets()
      .pipe(take(1))
      .subscribe(target => {
        expect(target.kind).toEqual(ChangeKind.Added);
        expect(target.webhook.title).toBe("wh2");
        done();
      });

    // insert stamps _id onto the given document, so build the second one up front
    const second = {...webhook, title: "wh2"};

    service
      .insert(webhook)
      .then(() => service.insert(second))
      .catch();
  });
});
