// @owner Kanan Gasimov

import {BaseHandler} from "./BaseHandler";

import type {HandlerRequest} from "../types";
import { withRequired } from "../decorators/withRequired";

export class RequiredHandler extends BaseHandler {
  handle(request: HandlerRequest): HandlerRequest {
    const {rules, Editor} = request;
    let updatedEditor = Editor;

    if (rules.canBeRequired) {
      updatedEditor = withRequired(Editor);
    }

    return super.handle({...request, Editor: updatedEditor});
  }
}

