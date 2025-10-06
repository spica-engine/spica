import { baseApi } from './baseApi';

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
      query: () => '/api/passport/strategies',
      providesTags: ['Auth'],
    }),
    
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/api/passport/identify',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth'],
      onQueryStarted: async (arg, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          // Store token in localStorage (matching your current implementation)
          localStorage.setItem('token', data.token);
        } catch (error) {
          console.error('Login failed:', error);
        }
      },
    }),
    
    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/api/passport/logout',
        method: 'POST',
      }),
      onQueryStarted: async (arg, { dispatch }) => {
        // Clear token and reset API state
        localStorage.removeItem('token');
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