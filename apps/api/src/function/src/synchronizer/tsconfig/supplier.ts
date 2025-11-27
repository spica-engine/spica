import {Observable} from "rxjs";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {FunctionService} from "@spica-server/function/services";
import {
  ChangeLog,
  ChangeType,
  ChangeOrigin,
  DocumentChangeSupplier
} from "@spica-server/interface/versioncontrol";
import * as CRUD from "../../../src/crud";
import {Function} from "@spica-server/interface/function";

const module = "function";
const subModule = "tsconfig";
const fileExtension = "json";

const getChangeLogForTsconfig = (type: ChangeType, fn: Function, content: string): ChangeLog => {
  return {
    module,
    sub_module: subModule,
    origin: ChangeOrigin.DOCUMENT,
    type,
    resource_id: fn._id.toString(),
    resource_slug: fn.name,
    resource_content: content,
    resource_extension: fileExtension,
    created_at: new Date()
  };
};

export const getSupplier = (
  engine: FunctionEngine,
  fs: FunctionService
): DocumentChangeSupplier => {
  return {
    module,
    subModule,
    listen(): Observable<ChangeLog> {
      return new Observable(observer => {
        CRUD.find(fs, engine, {
          filter: {
            language: "typescript"
          }
        }).then(functions => {
          try {
            functions.map(async fn => {
              const content = await engine.read(fn, "tsconfig");
              const changelog = getChangeLogForTsconfig(ChangeType.CREATE, fn, content);
              observer.next(changelog);
            });
          } catch (error) {
            observer.error(error);
            return;
          }
        });

        const subscription = engine.watch("tsconfig").subscribe({
          next: change => {
            const changeMap = {
              create: ChangeType.CREATE,
              update: ChangeType.UPDATE,
              delete: ChangeType.DELETE
            };
            const type = changeMap[change.type];

            if (!Object.values(ChangeType).includes(type)) {
              console.warn("Unknown change type:", change.type);
              return;
            }

            const changeLog = getChangeLogForTsconfig(type, change.fn, change.fn.content);
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
