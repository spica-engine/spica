export const DIRNAME = Symbol.for("DIRNAME");

export type Dirname = (actualDirname: string) => string;
