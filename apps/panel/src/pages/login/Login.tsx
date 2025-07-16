import {memo, useEffect} from "react";
import {useFormik} from "formik";
import {
  BaseInput,
  Button,
  FlexElement,
  Icon,
  Input,
  StringInput,
  Text,
  type IconName
} from "oziko-ui-kit";
import styles from "./Login.module.scss";
import Logo from "../../components/atoms/logo/Logo";
import useAuthService from "../../services/authService";
import useLocalStorage from "../../hooks/useLocalStorage";
import {Navigate} from "react-router-dom";

const Login = () => {
  const [token] = useLocalStorage("token", undefined);
  const {fetchStrategies, strategies, login, loginLoading, loginError} = useAuthService();

  const formik = useFormik({
    initialValues: {identifier: "", password: ""},
    onSubmit: values => login(values.identifier, values.password),
    validateOnChange: false,
    validateOnBlur: false
  });

  useEffect(() => {
    fetchStrategies();
  }, []);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

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
            <div className={styles.errorsContainer}>
              {loginError && (
                <div className={styles.errorBox}>
                  <div className={styles.errorText}>{loginError}</div>
                </div>
              )}
            </div>
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
                loginLoading
              }
              containerProps={{
                className: styles.formButtonContainer
              }}
            >
              <Icon name="login" size="xs" />
              Login
            </Button>

            {strategies?.map(strategy => (
              <Button
                key={strategy._id}
                fullWidth
                type="button"
                color="default"
                variant="outlined"
                disabled={loginLoading}
                containerProps={{
                  className: styles.formButtonContainer
                }}
              >
                <Icon size="sm" name={strategy.icon as IconName} />
                {strategy.title}
              </Button>
            ))}
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
