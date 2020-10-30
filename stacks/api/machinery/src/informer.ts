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

  for (const func of funcs) {
    if (options.type == "add" && func.add) {
      func.add(options.obj);
    } else if (options.type == "update" && func.update) {
      func.update(options.oldObj, options.newObj);
    } else if (options.type == "delete" && func.delete) {
      func.delete(options.obj);
    }
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
