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

const Login = () => {
  const {
    getStrategies,
    strategies,
    strategiesLoading,
    strategiesError,

    triggerStrategyLogin,
    strategyUrlLoading,
    strategyUrlError,

    login,
    loginLoading,
    loginError
  } = useAuthService();

  const handleLogin = async (values: {identifier: string; password: string}) => {
    login(values.identifier, values.password);
  };

  const formik = useFormik({
    initialValues: {identifier: "", password: ""},
    onSubmit: handleLogin,
    validateOnChange: false,
    validateOnBlur: false
  });

  useEffect(() => {
    getStrategies();
  }, []);

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
            {(loginLoading || strategiesLoading || strategyUrlLoading) && (
              <Text className={styles.loadingText} size="medium">
                {loginLoading && "Logging in..."}
                {strategiesLoading && "Loading login options..."}
                {strategyUrlLoading && "Connecting..."}
              </Text>
            )}
            <div>
              {loginError && (
                <div className={styles.errorBox}>
                  <div className={styles.errorText}>{loginError}</div>
                </div>
              )}
              {strategiesError && (
                <div className={styles.errorBox}>
                  <div className={styles.errorText}>{strategiesError}</div>
                </div>
              )}
              {strategyUrlError && (
                <div className={styles.errorBox}>
                  <div className={styles.errorText}>{strategyUrlError}</div>
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
                loginLoading ||
                strategyUrlLoading
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
                disabled={loginLoading || strategyUrlLoading}
                containerProps={{
                  className: styles.formButtonContainer
                }}
                onClick={() => {
                  triggerStrategyLogin(strategy);
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
