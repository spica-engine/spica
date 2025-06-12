import React, {memo, useState} from "react";
import {useFormik} from "formik";
import styles from "./Login.module.scss";
import {authorization} from "../../services/passport/identify";
import {useNavigate} from "react-router-dom";
import LoginForm from "../../components/organisms/login-form/LoginForm";

const getErrorMessage = (error: any): string => {
  return error.response?.data?.message || "An unexpected error occurred. Please try again.";
};

const Login = () => {
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleLogin = async (values: {identifier: string; password: string}) => {
    setIsLoading(true);

    try {
      const response = await authorization(values);
      if (response.data && response.data.token) {
        // localStorage.setItem('token', response.data.token);
        navigate("/home");
      } else {
        throw new Error("Invalid response: No authentication token received");
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error("Login failed:", error);
      setLoginError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const formik = useFormik({
    initialValues: {identifier: "", password: ""},
    onSubmit: handleLogin,
    validateOnChange: false,
    validateOnBlur: false
  });

  return (
    <div className={styles.container}>
      <form
        onSubmit={e => {
          e.preventDefault();
          formik.handleSubmit();
        }}
      >
        <LoginForm
          identifier={formik.values.identifier}
          password={formik.values.password}
          isLoading={isLoading}
          loginError={loginError}
          onIdentifierChange={value => formik.setFieldValue("identifier", value)}
          onPasswordChange={value => formik.setFieldValue("password", value)}
          onSubmit={formik.submitForm}
        />
      </form>
    </div>
  );
};

export default memo(Login);
