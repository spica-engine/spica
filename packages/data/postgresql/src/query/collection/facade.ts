import {Inject, Injectable} from "@nestjs/common";
import {fromRow, Orm} from "@spica-server/data-postgresql-orm";
import {CollectionQueryFacade, CountStrategy, Page, ReadSpec} from "@spica-server/interface-data";
import {ORM} from "../../orm.js";
import {countTotal} from "../bucket/totals.js";
import {readOnly} from "../read.js";
import {entityOf} from "./entities.js";
import {CollectionPlan, countPlanOf, planCollection} from "./plan.js";
import {CollectionReads} from "./reads.js";
import {relationsOf, resolveRelations} from "./relations.js";

type Record_ = Record<string, any>;

@Injectable()
export class PostgresCollectionQueryFacade implements CollectionQueryFacade {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  async find<T>(collection: string, spec: ReadSpec = {}): Promise<T[]> {
    const plan = this.plan(collection, spec);
    if (plan.matchesNothing) {
      return [];
    }
    return this.read(reads => this.records<T>(reads, plan, spec));
  }

  async findOne<T>(collection: string, spec: ReadSpec): Promise<T | null> {
    const [first] = await this.find<T>(collection, {...spec, limit: 1});
    return first ?? null;
  }

  async paginate<T>(collection: string, spec: ReadSpec, count: CountStrategy): Promise<Page<T>> {
    const plan = this.plan(collection, spec);
    if (plan.matchesNothing) {
      return {meta: {total: 0}, data: []};
    }
    return this.read(async reads => ({
      data: await this.records<T>(reads, plan, spec),
      meta: {total: await countTotal(reads, countPlanOf(plan), {exact: count == "exact"})}
    }));
  }

  private plan(collection: string, spec: ReadSpec) {
    const entity = entityOf(collection);
    return planCollection(entity, spec, relationsOf(collection, spec.relations));
  }

  private read<R>(work: (reads: CollectionReads) => Promise<R>): Promise<R> {
    return readOnly(this.orm, session => new CollectionReads(session), work);
  }

  private async records<T>(
    reads: CollectionReads,
    plan: CollectionPlan,
    spec: ReadSpec
  ): Promise<T[]> {
    const rows = await reads.page(plan, spec);
    const records = rows.map(row => fromRow(plan.entity, row)) as Record_[];
    await resolveRelations(reads, records, plan.relations.resolved, spec.fields);
    return records as T[];
  }
}
