// Then we find all the tests.
// @ts-ignore
const context = require.context('./', true, /\.spec\.ts$/);
// And load the modules.
context.keys().map(context);
