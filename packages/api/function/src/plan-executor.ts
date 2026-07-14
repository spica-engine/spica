import {Inject, Injectable, Logger} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";
import {Scheduler} from "@spica-server/function-scheduler";
import {DEFAULT_EVENT_CONCURRENCY} from "@spica-server/interface-function-scheduler";
import {event} from "@spica-server/function-queue-proto";
import path from "path";
import {FunctionService} from "@spica-server/function-services";
import {
  Options,
  FUNCTION_OPTIONS,
  Function,
  ChangeKind,
  TargetChange,
  FunctionChangePlan,
  EnvRelation,
  SecretRelation
} from "@spica-server/interface-function";
import {EnvVar} from "@spica-server/interface-env_var";
import {Secret, SECRET_DECRYPTOR, SecretDecryptor} from "@spica-server/interface-secret";
import * as CRUD from "./crud.js";

/**
 * Applies a {@link FunctionChangePlan} to the running system: it drives enqueuer subscriptions
 * (routing), retires stale workers (outdate), and re-syncs per-function scheduler config
 * (reconcile). It owns the "how", not the "what" — the plan is decided in change.ts.
 */
@Injectable()
export class PlanExecutor {
  private readonly logger = new Logger(PlanExecutor.name);

  constructor(
    private fs: FunctionService,
    private scheduler: Scheduler,
    @Inject(SECRET_DECRYPTOR) private secretDecryptor: SecretDecryptor,
    @Inject(FUNCTION_OPTIONS) private options: Options
  ) {}

  // Awaits reconcile so callers can gate on it: at startup this keeps the app from listening
  // before every function's execution context (env/secrets/timeout) is loaded into the
  // scheduler, otherwise a freshly-subscribed route could serve events with empty context.
  async apply(plan: FunctionChangePlan): Promise<void> {
    for (const change of plan.routing) {
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

    // Retire stale workers as part of reconcile: it holds the fresh target the scheduler needs to
    // pre-warm new-code replacements for a rolling cutover (supersedeWorkers), rather than a blind
    // outdate that would force the next event to cold-spawn. In every plan `outdate ⊆ reconcile`,
    // so iterating reconcile covers them; a stray outdate id (function truly gone) is hard-outdated
    // defensively below.
    const toSupersede = new Set(plan.outdate);
    const reconcileIds = new Set(plan.reconcile);

    await Promise.all([...reconcileIds].map(functionId => this.reconcile(functionId, toSupersede)));

    for (const functionId of toSupersede) {
      if (!reconcileIds.has(functionId)) {
        this.scheduler.outdateWorkers(functionId);
      }
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

  // Syncs a function's per-function scheduler settings (execution context, warm reserve,
  // concurrency) from its authoritative state. Per function, never per trigger: driving it per
  // trigger would let removing one trigger of a multi-trigger function drain the whole reserve,
  // and a multi-trigger update thrash it.
  private async reconcile(functionId: string, toSupersede: Set<string>): Promise<void> {
    const fn = await this.findFunctionForRuntime(functionId);

    // the function no longer exists (deleted / invalid id) — drop whatever it holds. Resetting
    // concurrency/context to their defaults clears the function's sparse-map entries.
    if (!fn) {
      const target = new event.Target({id: functionId});
      // function is gone, so there's no fresh code to roll over to — hard-outdate its workers.
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
    this.scheduler.reconcileConcurrency(target, fn.concurrencyPerWorker ?? DEFAULT_EVENT_CONCURRENCY);

    // supersede before refilling the warm reserve: supersedeWorkers kills the stale reserve, then
    // reconcileWarmWorkers rebuilds it from fresh state. A function with no active trigger has
    // nothing serving, so fall back to a plain outdate.
    if (toSupersede.has(functionId)) {
      if (hasActiveTrigger) {
        this.scheduler.supersedeWorkers(target);
      } else {
        this.scheduler.outdateWorkers(functionId);
      }
    }

    this.scheduler.reconcileWarmWorkers(target, hasActiveTrigger ? fn.warmWorkers ?? 0 : 0);
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
      return await CRUD.findOneForRuntime(this.fs, new ObjectId(functionId));
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
