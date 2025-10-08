import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import {
  useGetStrategiesQuery,
  useLoginMutation,
  useLogoutMutation,
} from "../store/api";
import { clearToken } from "../store";

function useAuthService() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  // RTK Query hooks
  const strategiesQuery = useGetStrategiesQuery();
  const [loginMutation, loginResult] = useLoginMutation();
  const [logoutMutation] = useLogoutMutation();

  // Maintain the same interface as your current authService
  const fetchStrategies = useCallback(() => {
    // RTK Query automatically fetches, but we can trigger refetch if needed
    return strategiesQuery.refetch();
  }, [strategiesQuery.refetch]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      console.log("Attempting login with identifier:", identifier);
      
      try {
        const loginData = await loginMutation({ identifier, password }).unwrap();
        // Token is automatically stored in localStorage via onQueryStarted
        navigate("/dashboard");
        return loginData;
      } catch (error) {
        console.error('Login failed:', error);
        throw error;
      }
    },
    [loginMutation, navigate]
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
    
    // Error states
    loginError: loginResult.error,
    strategiesError: strategiesQuery.error,
    
    // Functions (maintaining same interface)
    fetchStrategies,
    login,
    logout,
    
    // Additional RTK Query benefits
    refetchStrategies: strategiesQuery.refetch,
  };
}

export default useAuthService;