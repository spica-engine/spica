import { baseApi } from './baseApi';

export interface CommandsResponse {
  [key: string]: unknown;
}

export interface CommandArgs {
  args: string[];
}

export interface ExecuteCommandArgs {
  command: string;
  args: string[];
}

export interface LogCommit {
  hash: string;
  date: string;
  message: string;
  refs: string;
  body: string;
  author_name: string;
  author_email: string;
}

export interface LogResponse {
  all: LogCommit[];
  total: number;
  latest: LogCommit | null;
}

const VERSION_CONTROL_TAG = 'VersionControl' as const;

export const versionControlApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCommands: builder.query<CommandsResponse, void>({
      query: () => 'versioncontrol/commands',
      providesTags: [VERSION_CONTROL_TAG],
    }),

    getDiff: builder.mutation<unknown, CommandArgs>({
      query: (body) => ({
        url: 'versioncontrol/commands/diff',
        method: 'POST',
        body,
      }),
    }),

    commit: builder.mutation<unknown, CommandArgs>({
      query: (body) => ({
        url: 'versioncontrol/commands/commit',
        method: 'POST',
        body,
      }),
      invalidatesTags: [VERSION_CONTROL_TAG],
    }),

    branch: builder.mutation<unknown, CommandArgs>({
      query: (body) => ({
        url: 'versioncontrol/commands/branch',
        method: 'POST',
        body,
      }),
      invalidatesTags: [VERSION_CONTROL_TAG],
    }),

    remote: builder.mutation<unknown, CommandArgs>({
      query: (body) => ({
        url: 'versioncontrol/commands/remote',
        method: 'POST',
        body,
      }),
      invalidatesTags: [VERSION_CONTROL_TAG],
    }),

    push: builder.mutation<unknown, CommandArgs>({
      query: (body) => ({
        url: 'versioncontrol/commands/push',
        method: 'POST',
        body,
      }),
      invalidatesTags: [VERSION_CONTROL_TAG],
    }),

    log: builder.query<LogResponse, CommandArgs>({
      query: (body) => ({
        url: 'versioncontrol/commands/log',
        method: 'POST',
        body,
      }),
      providesTags: [VERSION_CONTROL_TAG],
    }),

    executeCommand: builder.mutation<unknown, ExecuteCommandArgs>({
      query: ({ command, args }) => ({
        url: `versioncontrol/commands/${command}`,
        method: 'POST',
        body: { args },
      }),
      invalidatesTags: [VERSION_CONTROL_TAG],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCommandsQuery,
  useGetDiffMutation,
  useCommitMutation,
  useBranchMutation,
  useRemoteMutation,
  usePushMutation,
  useLogQuery,
  useExecuteCommandMutation,
} = versionControlApi;

export const versionControlApiReducerPath = versionControlApi.reducerPath;
export const versionControlApiMiddleware = versionControlApi.middleware;
