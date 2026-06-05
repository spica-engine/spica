import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { RootState } from '../index';
import { selectParsedToken, clearToken } from '../slices/authSlice';

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_BASE_URL || "/api",
  prepareHeaders: (headers, { getState }) => {
    const token = selectParsedToken(getState() as RootState);
    
    if (token) {
      headers.set('Authorization', `IDENTITY ${token}`);
    }
    return headers;
  },
});

// Endpoints that legitimately return 401 as part of an in-progress auth flow
// (wrong password, wrong/expired MFA code). A 401 here means "this attempt was
// rejected", NOT "the session expired" — so it must surface to the caller as an
// error instead of force-logging-out and redirecting.
const AUTH_FLOW_PATHS = [
  'passport/identify', // login + login factor-authentication
  'start-factor-verification', // 2FA enrollment: begin
  'complete-factor-verification', // 2FA enrollment: confirm code
];

const getRequestUrl = (args: string | FetchArgs): string =>
  typeof args === 'string' ? args : args.url;

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    const url = getRequestUrl(args);
    const isAuthFlow = AUTH_FLOW_PATHS.some(path => url?.includes(path));

    if (!isAuthFlow) {
      api.dispatch(clearToken());
      api.dispatch({ type: 'NAVIGATE', payload: '/passport/identify' });
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Bucket',
    'BucketData',
    'Storage',
    'Auth',
    'Strategy',
    'ApiKey',
    'Identity',
    'Function',
    'Browse',
    'Policy',
    'Dashboard',
    'Activity',
    'Webhook',
    'Config',
    'ConfigSchema',
    'RefreshToken',
    'Secret',
    'EnvVar',
    'User',
  ],
  endpoints: () => ({}),
});

export default baseApi;