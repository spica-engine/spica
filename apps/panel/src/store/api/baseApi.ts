import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = localStorage.getItem('token');
    const parsedToken = token ? JSON.parse(token) : null;
    const balim = "Kardelen"
    console.log("token", balim);
    // console.log("header", `IDENTITY ${parsedToken}`);
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
  console.log("result", result);
  
  
  // if (result.error && result.error.status === 401) {
  //   // Handle token refresh or logout
  //   localStorage.removeItem('token');
  //   window.location.href = '/passport/identify';
  // }
  
  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Bucket', 'BucketData', 'Storage', 'Auth', 'Identity', 'Function'],
  endpoints: () => ({}),
});

export default baseApi;