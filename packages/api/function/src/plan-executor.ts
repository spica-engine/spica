import {Inject, Injectable, Logger} from "@nestjs/common";
import {Scheduler} from "@spica-server/function-scheduler";
import {DEFAULT_EVENT_CONCURRENCY} from "@spica-server/interface-function-scheduler";
import {event} from "@spica-server/function-queue-proto";
import path from "path";
import {COLLECTION_QUERY, CollectionQueryFacade} from "@spica-server/interface-data";
import {
  Options,
  FUNCTION_OPTIONS,
  Function,
  ChangeKind,
  TargetChange,
  FunctionChangePlan,
  FunctionRename,
  EnvRelation,
  SecretRelation
} from "@spica-server/interface-function";
import {EnvVar} from "@spica-server/interface-env_var";
import {Secret, SECRET_DECRYPTOR, SecretDecryptor} from "@spica-server/interface-secret";
import * as CRUD from "./crud.js";
import {TriggerSecretResolver} from "./trigger-secret-resolver.js";
import {FunctionPreparationService} from "./function-preparation.service.js";

@Injectable()
export class PlanExecutor {
  private readonly logger = new Logger(PlanExecutor.name);

  constructor(
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade,
    private scheduler: Scheduler,
    @Inject(SECRET_DECRYPTOR) private secretDecryptor: SecretDecryptor,
    @Inject(FUNCTION_OPTIONS) private options: Options,
    private secretResolver: TriggerSecretResolver,
    private preparationService: FunctionPreparationService
  ) {}

  async apply(plan: FunctionChangePlan): Promise<void> {
    await this.renameDirectories(plan.rename ?? []);

    const routing = await this.secretResolver.resolve(plan.routing);

    for (const change of routing) {
      switch (change.kind) {
        case ChangeKind.Added:
          this.subscribe(change);
          break;
        case ChangeKind.Updated:
          this.updateSubscription(change);
          break;
        case ChangeKind.Removed:
          this.unsubscribe(change);
          break;
      }
    }

    const toSupersede = new Set(plan.outdate);
    const reconcileIds = new Set(plan.reconcile);

    await Promise.all([...reconcileIds].map(functionId => this.reconcile(functionId, toSupersede)));

    for (const functionId of toSupersede) {
      if (!reconcileIds.has(functionId)) {
        this.scheduler.outdateWorkers(functionId);
      }
    }
  }

  private async renameDirectories(renames: FunctionRename[]): Promise<void> {
    for (const {from, to} of renames) {
      await this.preparationService
        .renameFunctionDirectory(from, to)
        .catch(err =>
          this.logger.error(
            `Failed to move function directory ${from} to ${to}. Reason: ${err instanceof Error ? err.message : err}`
          )
        );
    }
  }

  private getEnqueuer(name: string) {
    return Array.from(this.scheduler.enqueuers).find(e => e.description.name == name);
  }

  private buildTarget(change: TargetChange): event.Target {
    return new event.Target({
      id: change.target.id,
      cwd: path.join(this.options.root, change.target.name),
      handler: change.target.handler
    });
  }

  private subscribe(change: TargetChange) {
    const enqueuer = this.getEnqueuer(change.type);
    if (enqueuer) {
      enqueuer.subscribe(this.buildTarget(change), change.options);
    } else {
      this.logger.warn(`Couldn't find enqueuer ${change.type}.`);
    }
  }

  private updateSubscription(change: TargetChange) {
    this.unsubscribe(change);
    this.subscribe(change);
  }

  private unsubscribe(change: TargetChange) {
    const target = this.buildTarget(change);
    for (const enqueuer of this.scheduler.enqueuers) {
      enqueuer.unsubscribe(target);
    }
  }

  private async reconcile(functionId: string, toSupersede: Set<string>): Promise<void> {
    const fn = await this.findFunctionForRuntime(functionId);

    if (!fn) {
      const target = new event.Target({id: functionId});
      if (toSupersede.has(functionId)) {
        this.scheduler.outdateWorkers(functionId);
      }
      this.scheduler.reconcileContext(target, null);
      this.scheduler.reconcileWarmWorkers(target, 0);
      this.scheduler.reconcileConcurrency(target, DEFAULT_EVENT_CONCURRENCY);
      return;
    }

    const context = this.buildSchedulingContext(fn);
    const target = this.buildRuntimeTarget(fn, context);

    const triggers = fn.triggers || {};
    const hasActiveTrigger = Object.keys(triggers).some(handler => triggers[handler]?.active);

    this.scheduler.reconcileContext(target, context);
    this.scheduler.reconcileConcurrency(
      target,
      fn.concurrencyPerWorker ?? DEFAULT_EVENT_CONCURRENCY
    );

    if (toSupersede.has(functionId)) {
      if (hasActiveTrigger) {
        this.scheduler.supersedeWorkers(target);
      } else {
        this.scheduler.outdateWorkers(functionId);
      }
    }

    this.scheduler.reconcileWarmWorkers(target, hasActiveTrigger ? (fn.warmWorkers ?? 0) : 0);
  }

  private buildSchedulingContext(
    fn: Function<EnvRelation.Resolved, SecretRelation.Resolved>
  ): event.SchedulingContext {
    const env = {
      ...normalizeEnvVars(fn.env_vars as EnvVar[]),
      ...normalizeSecrets(fn.secrets as Secret[], this.secretDecryptor)
    };
    return new event.SchedulingContext({
      env: Object.keys(env).map(key => new event.SchedulingContext.Env({key, value: env[key]})),
      timeout: fn.timeout
    });
  }

  private buildRuntimeTarget(
    fn: Function<EnvRelation.Resolved, SecretRelation.Resolved>,
    context: event.SchedulingContext
  ): event.Target {
    return new event.Target({
      id: fn._id.toString(),
      cwd: path.join(this.options.root, fn.name),
      context
    });
  }

  private async findFunctionForRuntime(functionId: string) {
    try {
      return await CRUD.findOneForRuntime(this.queries, CRUD.functionIds().parse(functionId));
    } catch {
      return null;
    }
  }
}

function normalizeEnvVars(envVars: EnvVar[]) {
  return (envVars || []).reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});
}

function normalizeSecrets(secrets: Secret[], decryptor: SecretDecryptor) {
  return (secrets || []).reduce((acc, curr) => {
    const decrypted = decryptor(curr);
    acc[decrypted.key] = decrypted.value;
    return acc;
  }, {});
}
