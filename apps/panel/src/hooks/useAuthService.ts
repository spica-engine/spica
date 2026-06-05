import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import {
  useGetStrategiesQuery,
  useLoginMutation,
  useVerifyAuthFactorMutation,
  useLogoutMutation,
  isAuthFactorChallenge,
} from "../store/api";
import type { AuthFactorChallengeResponse } from "../store/api";
import { clearToken } from "../store";

function useAuthService() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // RTK Query hooks
  const strategiesQuery = useGetStrategiesQuery();
  const [loginMutation, loginResult] = useLoginMutation();
  const [verifyFactorMutation, verifyFactorResult] = useVerifyAuthFactorMutation();
  const [logoutMutation] = useLogoutMutation();

  // Maintain the same interface as your current authService
  const fetchStrategies = useCallback(() => {
    // RTK Query automatically fetches, but we can trigger refetch if needed
    return strategiesQuery.refetch();
  }, [strategiesQuery.refetch]);

  const login = useCallback(
    async (
      identifier: string,
      password: string
    ): Promise<AuthFactorChallengeResponse | null> => {
      try {
        const loginData = await loginMutation({ identifier, password }).unwrap();
        // MFA-enabled identity: credentials were accepted but a factor challenge
        // must be answered before a token is issued. Hand the challenge back to
        // the caller so it can render the second step instead of navigating.
        if (isAuthFactorChallenge(loginData)) {
          return loginData;
        }
        // Token is automatically stored in localStorage via onQueryStarted
        navigate("/dashboard");
        return null;
      } catch (error) {
        console.error('Login failed:', error);
        throw error;
      }
    },
    [loginMutation, navigate]
  );

  const verifyFactor = useCallback(
    async (answerUrl: string, answer: string) => {
      try {
        const data = await verifyFactorMutation({ answerUrl, answer }).unwrap();
        // Token is stored via onQueryStarted on success.
        navigate("/dashboard");
        return data;
      } catch (error) {
        console.error('Factor verification failed:', error);
        throw error;
      }
    },
    [verifyFactorMutation, navigate]
  );

  const logout = useCallback(async () => {
    try {
      await logoutMutation().unwrap();
      navigate("/passport/identify");
    } catch (error) {
      // Even if logout fails on server, clear local state using Redux
      dispatch(clearToken());
      navigate("/passport/identify");
    }
  }, [logoutMutation, navigate, dispatch]);

  return {
    // Data
    strategies: strategiesQuery.data || [],
    
    // Loading states
    strategiesLoading: strategiesQuery.isLoading,
    loginLoading: loginResult.isLoading,
    verifyFactorLoading: verifyFactorResult.isLoading,

    // Error states
    loginError: loginResult.error,
    verifyFactorError: verifyFactorResult.error,
    strategiesError: strategiesQuery.error,

    // Functions (maintaining same interface)
    fetchStrategies,
    login,
    verifyFactor,
    logout,
    
    // Additional RTK Query benefits
    refetchStrategies: strategiesQuery.refetch,
  };
}

export default useAuthService;