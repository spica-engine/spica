import {jest} from "@jest/globals";

jest.retryTimes(3, {logErrorsBeforeRetry: true});
