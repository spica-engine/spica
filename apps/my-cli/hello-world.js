#!/usr/bin/env node

const {program} = require("@caporal/core");

program.action(({logger}) => {
  logger.info("Hello, world!");
});

program.run();
