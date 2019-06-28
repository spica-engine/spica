import {ChangeStream, DatabaseModule, DatabaseService} from "@spica-server/database";
import {Logger, Module} from "@nestjs/common";
import {InvokerFn, Target, Trigger, TriggerSchema} from "./base";

interface DatabaseTriggerOptions {
  collection: string;
  type: string;
}

@Trigger({
  name: "database"
})
export class DatabaseTrigger implements Trigger<DatabaseTriggerOptions> {
  private streamMap = new Map<string, ChangeStream>();

  private logger = new Logger(DatabaseTrigger.name);

  constructor(private db: DatabaseService) {}

  schema(): Promise<TriggerSchema> {
    return this.db
      .listCollections()
      .toArray()
      .then(collections => {
        const scheme: TriggerSchema = {
          $id: "functions:triggers/database",
          title: "Database",
          description: "An database trigger for functions",
          type: "object",
          properties: {
            collection: {
              title: "Collection Name",
              type: "string",
              enum: collections.map(c => c.name).sort((a, b) => a.localeCompare(b))
            },
            type: {
              title: "Operation type",
              description: "Function will be triggered on these operations.",
              type: "string",
              enum: ["INSERT", "UPDATE", "REPLACE", "DELETE", "DROP"]
            },
            fullDocument: {
              title: "Full Document",
              type: "boolean",
              description: "Get the full document in your change event."
            }
          },
          additionalProperties: false
        };
        return scheme;
      });
  }

  register(invoker: InvokerFn, target: Target, options: DatabaseTriggerOptions) {
    const targetKey = `${target.id}_${target.handler}`;
    if (invoker) {
      const stream = this.db.collection(options.collection).watch([
        {
          $match: {operationType: options.type.toLowerCase()}
        }
      ]);
      stream.on("change", change => {
        invoker({target: target, parameters: [change]});
      });
      this.streamMap.set(targetKey, stream);
      this.logger.verbose(
        `Registered ${target.id}.${target.handler} to the collection {${options.collection}, ${options.type}}`
      );
    } else if (!invoker && this.streamMap.has(targetKey)) {
      this.streamMap.get(targetKey).close();
      this.logger.verbose(
        `Deregistered ${target.id}.${target.handler} from the collection {${options.collection}, ${options.type}}`
      );
    }
  }

  //TODO(thesayyn): Implement
  declarations(): Promise<string> {
    return Promise.resolve("");
  }
}

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: DatabaseTrigger,
      useClass: DatabaseTrigger,
      inject: [DatabaseService]
    }
  ],
  exports: [DatabaseTrigger]
})
export class DatabaseTriggerModule {}
