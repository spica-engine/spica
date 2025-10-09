import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { RootState } from '../index';
import { selectParsedToken, clearToken } from '../slices/authSlice';

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    // Get token from Redux store instead of localStorage
    const token = selectParsedToken(getState() as RootState);
    console.log("Using token from Redux store:", token);
    
    if (token) {
      headers.set('Authorization', `IDENTITY ${token}`);
    }
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    api.dispatch(clearToken());
    api.dispatch({ type: 'NAVIGATE', payload: '/passport/identify' });
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Bucket', 'BucketData', 'Storage', 'Auth', 'Identity', 'Function'],
  endpoints: () => ({}),
});

export default baseApi;