import {Entity, Orm} from "@spica-server/data-postgresql-orm";
import {LoadedRow} from "./loaded-row.js";

export class SystemLoader {
  constructor(
    private readonly orm: Orm,
    private readonly entity: Entity
  ) {}

  async load(key: string, changedColumns: string[] = []): Promise<LoadedRow> {
    const document = await this.orm.findById(this.entity, key);
    const fields = changedColumns.map(column => this.entity.byColumn.get(column)?.path[0]);
    return {
      document: (document ?? undefined) as Record<string, unknown> | undefined,
      changedFields: [...new Set(fields.filter(Boolean))]
    };
  }

  previous(before: Record<string, unknown>) {
    const document: Record<string, unknown> = {};
    for (const [column, value] of Object.entries(before)) {
      const resolved = this.entity.byColumn.get(column);
      if (resolved) {
        document[resolved.property] = value;
      }
    }
    return document;
  }
}
