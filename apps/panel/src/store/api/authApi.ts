import { baseApi } from './baseApi';
import { setToken, clearToken } from '../slices/authSlice';

export interface Strategy {
  icon: string;
  name: string;
  title: string;
  type: string;
  _id: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  issuer: string;
  scheme: string;
  token: string;
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStrategies: builder.query<Strategy[], void>({
      query: () => '/passport/strategies',
      providesTags: ['Auth'],
    }),
    
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/passport/identify',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth'],
      onQueryStarted: async (arg, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          // Store token in Redux store (which also persists to localStorage)
          dispatch(setToken(data.token));
        } catch (error) {
          console.error('Login failed:', error);
        }
      },
    }),
    
    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/passport/logout',
        method: 'POST',
      }),
      onQueryStarted: async (arg, { dispatch }) => {
        // Clear token from Redux store (which also clears localStorage)
        dispatch(clearToken());
        dispatch(baseApi.util.resetApiState());
      },
    }),
  }),
});

export const {
  useGetStrategiesQuery,
  useLoginMutation,
  useLogoutMutation,
} = authApi;