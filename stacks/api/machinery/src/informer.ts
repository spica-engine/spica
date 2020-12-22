import {GroupResource, GroupVersionResource} from "./scheme";

const informers = new Set<{
  groupVersionResource: GroupVersionResource;
  funcs: ResourceEventHandlerFuncs<unknown>;
}>();

export function register<T>(
  groupVersionResource: GroupVersionResource,
  funcs: ResourceEventHandlerFuncs<T>
) {
  informers.add({groupVersionResource, funcs});
}

export function inform<T>(options: InformAdd<T> | InformUpdate<T> | InformDelete<T>) {
  const funcs: ResourceEventHandlerFuncs<T>[] = [];
  for (const informer of informers.values()) {
    if (
      options.groupResource.group == informer.groupVersionResource.group &&
      options.groupResource.resource == informer.groupVersionResource.resource
    ) {
      funcs.push(informer.funcs);
    }
  }

  // TODO: conversion of the objects from to desired version

  const MAX_RETRY = 5;

  const process = async (func, retry = 1) => {
    try {
      if (options.type == "add" && func.add) {
        await func.add(options.obj);
      } else if (options.type == "update" && func.update) {
        await func.update(options.oldObj, options.newObj);
      } else if (options.type == "delete" && func.delete) {
        await func.delete(options.obj);
      }
    } catch (err) {
      if (retry - 1 >= MAX_RETRY) {
        return console.debug(
          `bail: informer has reached the exponetial back-off limit ${MAX_RETRY} for event ${options.type} on ${options.groupResource.group} ${options.groupResource.resource}`
        );
      }
      console.log(err);
      console.debug(
        `retrying (${retry}) the event ${options.type} on ${options.groupResource.group} ${options.groupResource.resource}`
      );
      await new Promise(resolve => setTimeout(resolve, retry * 1000));
      await process(func, retry++);
    }
  };

  for (const func of funcs) {
    process(func);
  }
}

export interface InformOptions {
  groupResource: GroupResource;
}

export interface InformAdd<T> extends InformOptions {
  type: "add";
  obj: T;
}

export interface InformUpdate<T> extends InformOptions {
  type: "update";
  oldObj: T;
  newObj: T;
}

export interface InformDelete<T> extends InformOptions {
  type: "delete";
  obj: T;
}

export interface ResourceEventHandlerFuncs<T> {
  add?(obj: T): void;
  update?(oldObj: T, newObj: T): void;
  delete?(obj: T): void;
}
