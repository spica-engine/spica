import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    
    //TODO: Decouple persistence from transport in the fetch layer.
    const token = localStorage.getItem('token'); 

    const parsedToken = token ? JSON.parse(token) : null;

    if (parsedToken) {
      headers.set('Authorization', `IDENTITY ${parsedToken}`);
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
    localStorage.removeItem('token');
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