import React, { memo, useState } from "react";
import { useFormik } from "formik";
import { BaseInput, Button, FlexElement, Icon, Input, StringInput, Text } from "oziko-ui-kit";
import styles from "./Login.module.scss";
import Logo from "../../components/atoms/logo/Logo";
import { authorization } from "../../services/passport/identify";
import { useNavigate } from "react-router-dom";

const getErrorMessage = (error: any): string => {
  return error.response?.data?.message || "An unexpected error occurred. Please try again.";
};

const Login = () => {
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleLogin = async (values: { identifier: string; password: string }) => {
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
    initialValues: { identifier: "", password: "" },
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
        <FlexElement direction="vertical" gap={10}>
          <FlexElement
            className={styles.contentContainer}
            dimensionX={400}
            direction="vertical"
            gap={10}
          >
            <Logo size="xl" />

            {loginError && <div className={styles.errorText}>{loginError}</div>}

            <StringInput
              id="identifier"
              label="Name"
              value={formik.values.identifier}
              onChange={(value: string) => {
                formik.setFieldValue("identifier", value);
              }}
              onBlur={() => formik.setFieldTouched("identifier", true)}
              className={styles.stringInput}
            />

            <BaseInput
              dimensionX="fill"
              className={styles.stringInput}
              labelProps={{
                dimensionX: "hug",
                divider: true,
                prefix: {
                  children: <Icon className={styles.passwordIcon} name="eye" />
                },
                root: {
                  dimensionX: "hug",
                  children: (
                    <Text className={styles.passwordText} size="medium">
                      Password
                    </Text>
                  )
                }
              }}
            >
              <Input
                id="password"
                value={formik.values.password}
                onChange={event => {
                  formik.setFieldValue("password", event.target.value);
                }}
                onBlur={() => formik.setFieldTouched("password", true)}
                type="password"
              />
            </BaseInput>
            <Button
              fullWidth
              type="submit"
              disabled={
                formik.values.identifier.length < 3 ||
                formik.values.password.length < 3 ||
                isLoading
              }
              className={styles.formButton}
              containerProps={{
                className: styles.formButtonContainer
              }}

            >
              <Icon name="login" size="xs" />
              Login
            </Button>

            <Button
              fullWidth
              type="button"
              color="default"
              variant="outlined"
              className={styles.formButton}
              containerProps={{
                className: styles.formButtonContainer
              }}
            >
              <Logo size="sm" type="withoutText" />
              Login With Spica Account
            </Button>
          </FlexElement>

          <FlexElement
            alignment="rightCenter"
            dimensionX={"fill"}
            className={styles.bottomContainer}
            dimensionY={16}
            gap={0}
          >
            <Button
              variant="icon"
              type="button"
              className={styles.linkButtons}
              onClick={() =>
                window.open("https://spicaengine.com/docs/start/getting-started", "_blank")
              }
            >
              <Icon name="article" size="sm" />
              Documentation
            </Button>
            <Button
              variant="icon"
              type="button"
              className={styles.linkButtons}
              onClick={() => window.open("https://github.com/spica-engine/spica", "_blank")}
            >
              <Icon name="github" size="sm" />
              Github
            </Button>
          </FlexElement>
        </FlexElement>
      </form>
    </div>
  );
};

export default memo(Login);
