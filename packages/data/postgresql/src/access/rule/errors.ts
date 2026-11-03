export class RuleCompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnsupportedRuleError extends RuleCompileError {}

export class InvalidRuleError extends RuleCompileError {}
