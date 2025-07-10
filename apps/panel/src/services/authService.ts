import {useCallback} from "react";
import {useNavigate} from "react-router-dom";
import useApi from "../hooks/useApi";
import useLocalStorage from "../hooks/useLocalStorage";

type LoginData = {issuer: string; scheme: string; token: string};
type Strategy = {icon: string; name: string; title: string; type: string; _id: string};

function useAuthService() {
  const navigate = useNavigate();
  const [_, setToken] = useLocalStorage("token", "");

  const {
    request: fetchStrategies,
    data: strategies,
    loading: strategiesLoading
  } = useApi<Strategy[]>({
    endpoint: "/api/passport/strategies",
    method: "get"
  });

  const {
    request: requestLogin,
    error: loginError,
    loading: loginLoading
  } = useApi<LoginData>({
    endpoint: "/api/passport/identify",
    method: "post"
  });

  const login = useCallback(
    (identifier: string, password: string) => {
      requestLogin({body: {identifier, password}}).then(loginData => {
        if (!loginData) return;
        setToken(loginData.token);
        navigate("/home");
      });
    },
    [requestLogin]
  );

  return {
    fetchStrategies,
    strategies,
    strategiesLoading,
    login,
    loginLoading,
    loginError
  };
}

export default useAuthService;
