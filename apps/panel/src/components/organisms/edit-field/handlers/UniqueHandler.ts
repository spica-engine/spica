// @owner Kanan Gasimov

import {BaseHandler} from "./BaseHandler";
import {withUnique} from "../decorators/withUnique";
import type {HandlerRequest} from "../types";

export class UniqueHandler extends BaseHandler {
  handle(request: HandlerRequest): HandlerRequest {
    const {rules, Editor} = request;
    let updatedEditor = Editor;

    if (rules.canBeUnique) {
      updatedEditor = withUnique(Editor);
    }

    return super.handle({...request, Editor: updatedEditor});
  }
}

