export const AUTH_RESOLVER = Symbol.for("AUTH_RESOLVER");

export interface IAuthResolver {
  getProperties(): object;
  resolveRelations(dentity: any, aggregation: object[]): Promise<any>;
}
