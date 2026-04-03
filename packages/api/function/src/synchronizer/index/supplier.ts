import {Observable} from "rxjs";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {FunctionService} from "@spica-server/function-services";
import {
  ChangeLog,
  ChangeSupplier,
  ChangeType,
  ChangeOrigin,
  ChangeInitiator
} from "@spica-server/interface-versioncontrol";
import * as CRUD from "../../../src/crud.js";
import {Function} from "@spica-server/interface-function";
import {Logger} from "@nestjs/common";

const logger = new Logger("FunctionIdxSyncSupplier");

const module = "function";
const subModule = "index";
const findExtension = fn => {
  if (fn.language === "javascript") return "mjs";
  if (fn.language === "typescript") return "ts";
  console.warn(
    `Unknown language ${fn.language} for function ${fn._id}, defaulting to 'mjs' extension`
  );
  return "mjs";
};

const getChangeLogForIndex = (
  type: ChangeType,
  fn: Function,
  content: string,
  initiator: ChangeInitiator,
  eventId: string
): ChangeLog => {
  return {
    module,
    sub_module: subModule,
    origin: ChangeOrigin.DOCUMENT,
    type,
    resource_id: fn._id.toString(),
    resource_slug: fn.name,
    resource_content: content,
    resource_extension: findExtension(fn),
    created_at: new Date(),
    initiator,
    event_id: eventId
  };
};

export const getSupplier = (engine: FunctionEngine, fs: FunctionService): ChangeSupplier => {
  return {
    module,
    subModule,
    listen(): Observable<ChangeLog> {
      return new Observable(observer => {
        CRUD.find(fs, engine, {}).then(functions => {
          functions.forEach(async fn => {
            try {
              const content = await engine.read(fn, "index");
              const changelog = getChangeLogForIndex(
                ChangeType.CREATE,
                fn,
                content,
                ChangeInitiator.INTERNAL,
                fn._id.toString()
              );
              observer.next(changelog);
            } catch (error) {
              observer.error(`Error on fn ${fn._id} index read: ${error}`);
            }
          });
        });

        const subscription = engine.watch("index").subscribe({
          next: change => {
            const changeMap = {
              create: ChangeType.CREATE,
              update: ChangeType.UPDATE,
              delete: ChangeType.DELETE
            };
            const type = changeMap[change.type];

            if (!Object.values(ChangeType).includes(type)) {
              logger.warn(`Unknown change type: ${change.type}`);
              return;
            }

            const changeLog = getChangeLogForIndex(
              type,
              change.fn,
              change.fn.content,
              ChangeInitiator.EXTERNAL,
              change.event_id
            );
            observer.next(changeLog);
          },
          error: error => {
            observer.error(error);
          }
        });

        return () => {
          subscription.unsubscribe();
        };
      });
    }
  };
};
