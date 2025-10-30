import {BaseHandler} from "./BaseHandler";
import type {HandlerRequest} from "../types";
import { withTranslatable } from "../decorators/withTranslatable";


export class TranslatableHandler extends BaseHandler {
  handle(request: HandlerRequest): HandlerRequest {
    const {rules, Editor} = request;
    let updatedEditor = Editor;

    if (rules.canBeTranslatable) {
      updatedEditor = withTranslatable(Editor);
    }

    return super.handle({...request, Editor: updatedEditor});
  }
}

