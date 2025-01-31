import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule, stream} from "@spica-server/database/testing";
import {ChangeKind, Webhook, WebhookService} from "@spica-server/function/webhook";
import {bufferCount, bufferTime, take} from "rxjs/operators";

describe("Webhook Service", () => {
  let service: WebhookService;
  let module: TestingModule;
  let webhook: Webhook;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()],
      providers: [WebhookService]
    }).compile();
    service = module.get(WebhookService);

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
        .pipe(bufferTime(1000))
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
    stream.wait().then(() => service.insertOne(webhook).then(_hook => (hook = _hook)));
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

      stream.wait().then(() => service.deleteOne({_id: hook._id}));
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
      stream
        .wait()
        .then(() => service.updateOne({_id: hook._id}, {$set: {"trigger.active": false}}));
    });
  });
});
