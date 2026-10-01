import {fromEvent, of} from "rxjs";
import {catchError, concatMap, takeUntil} from "rxjs/operators";
import {RealtimeDatabaseService} from "@spica-server/database-realtime";
import {ResourceFilterFunction, IGuardService} from "@spica-server/interface-passport-guard";

export function getConnectionHandlers(
  guardService: IGuardService,
  getCollectionName: (client: any, req: any) => Promise<string>,
  getFindOptions: (client: any, req: any) => Promise<any>,
  buildErrorMessage: (error: any) => any,
  realtime: RealtimeDatabaseService,
  resourceFilterFunction?: ResourceFilterFunction,
  authAction?: string,
  documentTransformFactories?: ((
    client: any,
    req: any
  ) => Promise<((data: any) => any) | undefined> | ((data: any) => any) | undefined)[]
) {
  async function handleConnection(client: any, req: any) {
    req.headers.authorization = req.headers.authorization || req.query.get("Authorization");

    try {
      await guardService.checkAuthentication({
        request: req,
        response: client
      });

      if (authAction) {
        await guardService.checkAuthorization({
          request: req,
          response: client,
          actions: authAction,
          options: {resourceFilter: !!resourceFilterFunction}
        });

        if (resourceFilterFunction) {
          req.resourceFilter = resourceFilterFunction({}, {
            switchToHttp: () => ({
              getRequest: () => req
            })
          } as any);
        }
      }
    } catch (error) {
      closeGracefully(client, error);
      return;
    }

    let collection;
    let options;
    try {
      collection = await getCollectionName(client, req);
      options = await getFindOptions(client, req);
    } catch (error) {
      closeGracefully(client, error);
      return;
    }

    if (!options || !collection) {
      return;
    }

    const documentTransforms = documentTransformFactories
      ? await Promise.all(
          documentTransformFactories.map(factory => Promise.resolve(factory(client, req)))
        )
      : [];

    const stream = realtime.find(collection, options).pipe(
      concatMap(async data => {
        if (data === null) return data;
        let document = data.document;
        for (const transform of documentTransforms) {
          if (transform) {
            document = await transform(document);
          }
        }
        data.document = document;
        return data;
      }),
      catchError(error => {
        closeGracefully(client, error);
        return of(null);
      })
    );

    stream.pipe(takeUntil(fromEvent(client, "close"))).subscribe(data => {
      if (data !== null) {
        client.send(JSON.stringify(data));
      }
    });
  }

  /**
   * A disconnect must not throw — and the reason is not tidiness.
   *
   * `getCollectionName` raises on a request it cannot resolve (`/bucket/<garbage>/data`, for instance).
   * `handleConnection` catches that and closes the socket, but this handler did not, and it is invoked
   * from inside an RxJS subscriber: the rejection escaped as an unhandled error and **took the whole API
   * process down**. Any client could do it by opening one websocket on a malformed path and closing it
   * again. Measured at a real boot, on both backends — this file is backend-neutral.
   *
   * Returning early is correct rather than merely safe: a request that cannot be resolved never got past
   * `handleConnection`, so no emitter was ever registered and there is nothing to clean up. The client
   * was already told why its connection closed.
   */
  async function handleDisconnect(client: any, req: any) {
    let collection: string;
    let options: unknown;
    try {
      collection = await getCollectionName(client, req);
      options = await getFindOptions(client, req);
    } catch {
      return;
    }

    if (realtime.doesEmitterExist(collection, options)) {
      realtime.removeEmitter(collection, options);
    }
  }

  function closeGracefully(client: any, error: Error) {
    const errMsg = buildErrorMessage(error);
    client.send(JSON.stringify(errMsg));
    client.close(1003);
    return;
  }

  return {
    handleConnection,
    handleDisconnect
  };
}
