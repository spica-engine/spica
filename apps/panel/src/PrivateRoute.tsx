import {Navigate, Outlet} from "react-router-dom";
import useLocalStorage from "./hooks/passport/identify";

const PrivateRoute = () => {
  const {isValid} = useLocalStorage();
  return isValid() ? <Outlet /> : <Navigate to="/" replace />;
};

export default PrivateRoute;
