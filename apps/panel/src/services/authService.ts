import {useCallback, useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import useApi from "../hooks/useApi";
import useLocalStorage from "../hooks/useLocalStorage";

type LoginData = {issuer: string; scheme: string; token: string};
type Strategy = {icon: string; name: string; title: string; type: string; _id: string};
type StrategyUrlData = {url: string; state: string};

function useAuthService() {
  const navigate = useNavigate();
  const [_, setToken] = useLocalStorage("token", "");
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);

  const {
    request: fetchStrategies,
    data: strategies,
    error: strategiesError,
    loading: strategiesLoading
  } = useApi<Strategy[]>({
    endpoint: "/api/passport/strategies",
    method: "get"
  });

  const strategyId = selectedStrategy?._id;
  const {
    request: fetchStrategyUrl,
    data: strategyUrl,
    error: strategyUrlError,
    loading: strategyUrlLoading
  } = useApi<StrategyUrlData>({
    endpoint: `/api/passport/strategy/${strategyId}/url`,
    method: "get"
  });

  useEffect(() => {
    if (!strategyId) return;
    fetchStrategyUrl();
  }, [strategyId, fetchStrategyUrl]);

  useEffect(() => {
    if (strategyUrl?.url) {
      window.location.href = strategyUrl.url;
    }
  }, [strategyUrl?.url]);

  const triggerStrategyLogin = useCallback(
    (strategy: Strategy) => {
      if (strategy._id === selectedStrategy?._id) {
        fetchStrategyUrl();
        return;
      }
      setSelectedStrategy(strategy);
    },
    [selectedStrategy, fetchStrategyUrl]
  );

  const {
    request: requestLogin,
    data: loginData,
    error: loginError,
    loading: loginLoading
  } = useApi<LoginData>({
    endpoint: "/api/passport/identify",
    method: "post"
  });

  const login = useCallback(
    (identifier: string, password: string) => {
      requestLogin({body: {identifier, password}});
    },
    [requestLogin]
  );

  useEffect(() => {
    if (!loginData) return;
    setToken(loginData.token);
    navigate("/home");
  }, [loginData, navigate, setToken]);

  const result = useMemo(
    () => ({
      getStrategies: fetchStrategies,
      strategies,
      strategiesLoading,
      strategiesError: strategiesError
        ? `Couldn't load login options. You can still log in with your credentials. ${strategiesError}`
        : undefined,

      triggerStrategyLogin,
      strategyUrlLoading,
      strategyUrlError: strategyUrlError
        ? `Couldn't connect${selectedStrategy?.name ? ` to ${selectedStrategy.name}` : ""}. Please try again. ${strategyUrlError}`
        : undefined,

      login,
      loginLoading,
      loginError: loginError === "Request failed with status code 401" ? "Identifier or password was incorrect." : loginError,
    }),
    [
      fetchStrategies,
      strategies,
      strategiesLoading,
      strategiesError,
      triggerStrategyLogin,
      strategyUrlLoading,
      strategyUrlError,
      selectedStrategy?.name,
      login,
      loginLoading,
      loginError
    ]
  );

  return result;
}

export default useAuthService;
