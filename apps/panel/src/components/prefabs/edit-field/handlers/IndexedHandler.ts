import {BaseHandler} from "./BaseHandler";
import type {HandlerRequest} from "../types";
import { withIndexed } from "../decorators/withIndexed";

export class IndexedHandler extends BaseHandler {
  handle(request: HandlerRequest): HandlerRequest {
    const {rules, Editor} = request;
    let updatedEditor = Editor;

    if (rules.canBeIndexed) {
      updatedEditor = withIndexed(Editor);
    }

    return super.handle({...request, Editor: updatedEditor});
  }
}

