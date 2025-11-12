import {Observable} from "rxjs";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {FunctionService} from "@spica-server/function/services";
import {
  ChangeLog,
  ChangeSupplier,
  ChangeType,
  ChangeOrigin
} from "@spica-server/interface/versioncontrol";
import * as CRUD from "../../../src/crud";

const module = "function";
const subModule = "index";
const fileExtension = "js";

export const supplier = (engine: FunctionEngine, fs: FunctionService): ChangeSupplier => {
  return {
    module,
    subModule,
    fileExtension,
    listen(): Observable<ChangeLog> {
      return new Observable(observer => {
        CRUD.find(fs, engine, {}).then(async functions => {
          try {
            await Promise.all(
              functions.map(async fn => {
                const content = await engine.read(fn, "index");
                observer.next({
                  module,
                  sub_module: subModule,
                  origin: ChangeOrigin.DOCUMENT,
                  type: ChangeType.CREATE,
                  resource_id: fn._id.toString(),
                  resource_slug: fn.name,
                  resource_content: content,
                  created_at: new Date()
                });
              })
            );
          } catch (error) {
            observer.error(error);
            return;
          }
        });

        const subscription = engine.watch("index").subscribe({
          next: change => {
            let type = ChangeType.UPDATE;
            if (!change.content) {
              type = ChangeType.DELETE;
            }

            const changeLog: ChangeLog = {
              module,
              sub_module: subModule,
              origin: ChangeOrigin.DOCUMENT,
              type,
              resource_id: change._id.toString(),
              resource_slug: change.name,
              resource_content: change.content,
              created_at: new Date()
            };
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
