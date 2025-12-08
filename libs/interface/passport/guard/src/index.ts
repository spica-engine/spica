import {ExecutionContext} from "@nestjs/common";

export enum ReqAuthStrategy {
  APIKEY,
  IDENTITY,
  USER
}
export interface Statement {
  action: string;
  resource: {
    include: string[];
    exclude: string[];
  };
  module: string;
}

export interface PrepareUser {
  (request: any): any;
}

export interface IGuardService {
  checkAction({
    request,
    response,
    actions,
    options
  }: {
    request: any;
    response: any;
    actions: string | string[];
    options?: {resourceFilter: boolean};
  }): Promise<boolean>;

  checkAuthorization({
    request,
    response,
    allowedStrategies
  }: {
    request: any;
    response: any;
    allowedStrategies?: string[];
  });
}

// Since we can not depend on since
export type PolicyResolver<T = unknown> = (ids: string[]) => Promise<T[]>;

export type ResourceFilterFunction = (data: {pure?: boolean}, ctx: ExecutionContext) => {};

/**
 * Since we can not depend on policy service directly cause it would create a circular dependency,
 * we have to depend on a factory function that resolves policy ids to real policy objects
 */
export const POLICY_RESOLVER = Symbol.for("POLICY_RESOLVER");
