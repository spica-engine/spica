import {Inject, Injectable} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {Id} from "@spica-server/interface-data";
import {Preference, PreferenceRepository} from "@spica-server/interface-preference";
import {preferences, StoredPreference} from "../../entities/index.js";
import {ORM} from "../../orm.js";

const toPreference = (stored: StoredPreference | null): Preference | null =>
  stored && {...stored.value, _id: stored._id, scope: stored.scope};

const toStored = ({_id, scope, ...value}: Preference): StoredPreference => ({_id, scope, value});

@Injectable()
export class PostgresPreferenceRepository implements PreferenceRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  async findById(id: Id) {
    return toPreference(await this.orm.findById(preferences, id));
  }

  async findByScope(scope: string) {
    return toPreference(await this.orm.findOne(preferences, {scope}));
  }

  async insert(preference: Preference) {
    return toPreference(await this.orm.insert(preferences, toStored(preference)))!;
  }

  async replaceByScope(scope: string, preference: Preference) {
    const stored = toStored({...preference, scope});
    return toPreference(
      await this.orm.upsert(preferences, stored, {conflict: ["scope"], update: ["value"]})
    )!;
  }
}
