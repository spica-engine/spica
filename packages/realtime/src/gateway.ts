import {fromEvent, of} from "rxjs";
import {catchError, concatMap, takeUntil} from "rxjs/operators";
import {RealtimeDatabaseService} from "@spica-server/database/realtime";
import {ResourceFilterFunction, IGuardService} from "@spica-server/interface/passport/guard";

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

  async function handleDisconnect(client: any, req: any) {
    const collection = await getCollectionName(client, req);
    const options = await getFindOptions(client, req);

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
