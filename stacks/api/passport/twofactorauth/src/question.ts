import {Factor, FactorMeta, FactorSchema, TwoFactorAuthSchemaProvider} from "./interface";

export const QuestionFactorSchemaProvider: TwoFactorAuthSchemaProvider = () => {
  const schema: FactorSchema = {
    type: "question",
    title: "Security Question",
    description: "Answer the security question.",
    config: {
      question: {
        type: "string",
        enum: ["What are you?", "How are you?"]
      }
    }
  };
  return Promise.resolve(schema);
};

export interface QuestionFactorMeta extends FactorMeta {
  type: "question";
  config: {
    question: string;
  };
}

export class Question implements Factor {
  readonly name = "question";

  meta: QuestionFactorMeta;

  constructor(meta: QuestionFactorMeta) {
    this.meta = meta;
  }

  getMeta() {
    return this.meta;
  }

  start() {
    return Promise.resolve(`Please answer the question: ${this.meta.config}?`);
  }

  authenticate(answer: string) {
    return Promise.resolve(this.meta.secret == answer);
  }
}
