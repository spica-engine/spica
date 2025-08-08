import {fromEvent, of} from "rxjs";
import {catchError, takeUntil} from "rxjs/operators";
import {RealtimeDatabaseService} from "../../database/realtime";
import {ResourceFilterFunction, IGuardService} from "../../interface/passport/guard";

export function getConnectionHandlers(
  guardService: IGuardService,
  getCollectionName: (client: any, req: any) => Promise<string>,
  getFindOptions: (client: any, req: any) => Promise<any>,
  buildErrorMessage: (error: any) => any,
  realtime: RealtimeDatabaseService,
  resourceFilterFunction?: ResourceFilterFunction,
  authAction?: string
) {
  async function handleConnection(client: any, req: any) {
    req.headers.authorization = req.headers.authorization || req.query.get("Authorization");

    try {
      await guardService.checkAuthorization({
        request: req,
        response: client
      });

      if (authAction) {
        await guardService.checkAction({
          request: req,
          response: client,
          actions: authAction,
          options: {resourceFilter: true}
        });

        req.resourceFilter = resourceFilterFunction({}, {
          switchToHttp: () => ({
            getRequest: () => req
          })
        } as any);
      }
    } catch (error) {
      const errMsg = buildErrorMessage(error);
      client.send(JSON.stringify(errMsg));
      client.close(1003);
      return;
    }

    const collection = await getCollectionName(client, req);
    const options = await getFindOptions(client, req);

    const stream = realtime.find(collection, options).pipe(
      catchError(error => {
        const errMsg = buildErrorMessage(error);
        client.send(JSON.stringify(errMsg));
        client.close(1003);
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

  return {
    handleConnection,
    handleDisconnect
  };
}
