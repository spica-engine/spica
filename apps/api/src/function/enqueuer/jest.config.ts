const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

export default {
  preset: "../../../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/apps/api/function/enqueuer"),
  testMatch: ["<rootDir>/test/rabbitmq.spec.ts"]
  // moduleNameMapper: {"^amqplib$": "<rootDir>/__mocks__/amqplib.ts"}
};
