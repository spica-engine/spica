// @owner Kanan Gasimov

import {BaseHandler} from "./BaseHandler";
import {withPrimary} from "../decorators/withPrimary";
import type {HandlerRequest} from "../types";

export class PrimaryHandler extends BaseHandler {
  handle(request: HandlerRequest): HandlerRequest {
    const {rules, Editor} = request;
    let updatedEditor = Editor;

    if (rules.canBePrimary) {
      updatedEditor = withPrimary(Editor);
    }

    return super.handle({...request, Editor: updatedEditor});
  }
}

