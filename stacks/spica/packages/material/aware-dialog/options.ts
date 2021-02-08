import {TemplateRef} from "@angular/core";

export interface MatAwareDialogOptions {
  icon?: string;
  title: string;
  templateOrDescription: TemplateRef<any> | string;
  answer: string;
  answerHint?: string;
  confirmText?: string;
  cancelText?: string;
  noAnswer?: boolean;
  list?: any[];
}
