import "./jest.setup.js";
import {jest} from "@jest/globals";

jest.retryTimes(3, {logErrorsBeforeRetry: true});
