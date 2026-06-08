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

/** Successful identify/factor-verification response: a usable access token. */
export interface LoginSuccessResponse {
  issuer?: string;
  scheme: string;
  token: string;
}

/**
 * Returned by `POST passport/identify` when the identity has a registered
 * multi-factor auth factor. The credentials were correct, but a second step is
 * required: the user must answer `challenge` and POST it to `answerUrl`.
 *
 * `challenge` is typically the instruction string "Please enter the 6 digit
 * code"; on first-time setup it may be a `data:image/...` QR code URL.
 */
export interface AuthFactorChallengeResponse {
  challenge: string;
  answerUrl: string;
}

export type LoginResponse = LoginSuccessResponse | AuthFactorChallengeResponse;

/** Narrows a login response to the MFA challenge variant. */
export function isAuthFactorChallenge(
  res: LoginResponse | undefined
): res is AuthFactorChallengeResponse {
  return !!res && typeof (res as AuthFactorChallengeResponse).answerUrl === "string";
}

export interface VerifyAuthFactorRequest {
  /** Relative URL returned by the identify step, e.g. `passport/identify/<id>/factor-authentication`. */
  answerUrl: string;
  /** The factor answer, e.g. the 6 digit TOTP code. */
  answer: string;
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStrategies: builder.query<Strategy[], void>({
      query: () => 'passport/strategies',
      providesTags: ['Auth'],
    }),
    
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: 'passport/identify',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth'],
      onQueryStarted: async (arg, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          // When the identity has MFA enabled the response carries a challenge
          // instead of a token; the token only arrives after factor verification.
          if (!isAuthFactorChallenge(data)) {
            // Store token in Redux store (which also persists to localStorage)
            dispatch(setToken(data.token));
          }
        } catch (error) {
          console.error('Login failed:', error);
        }
      },
    }),

    // Second leg of the MFA login: POST the factor answer (e.g. 6 digit TOTP
    // code) to the answerUrl handed back by the identify step. On success the
    // access token is returned and stored exactly like a passwordless login.
    verifyAuthFactor: builder.mutation<LoginSuccessResponse, VerifyAuthFactorRequest>({
      query: ({ answerUrl, answer }) => ({
        url: answerUrl,
        method: 'POST',
        body: { answer },
      }),
      invalidatesTags: ['Auth'],
      onQueryStarted: async (arg, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          if (data?.token) {
            dispatch(setToken(data.token));
          }
        } catch (error) {
          console.error('Factor verification failed:', error);
        }
      },
    }),

    logout: builder.mutation<void, void>({
      query: () => ({
        url: 'passport/logout',
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
  useVerifyAuthFactorMutation,
  useLogoutMutation,
} = authApi;