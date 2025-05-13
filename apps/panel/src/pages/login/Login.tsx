import React, {memo} from "react";
import {useFormik} from "formik";
import * as Yup from "yup";
import {BaseInput, Button, FlexElement, Icon, Input, StringInput, Text} from "oziko-ui-kit";
import styles from "./Login.module.scss";
import Logo from "../../components/atoms/logo/Logo";

const validationSchema = Yup.object({
  name: Yup.string().min(3, "Name must be at least 3 characters").required("Name is required"),
  password: Yup.string()
    .min(3, "Password must be at least 3 characters")
    .required("Password is required")
});

const Login = () => {
  const formik = useFormik({
    initialValues: {name: "", password: ""},
    validationSchema,
    onSubmit: values => {
      console.log("Login with:", values);
    },
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
        <FlexElement direction="vertical" gap={5}>
          <FlexElement
            className={styles.contentContainer}
            dimensionX={400}
            direction="vertical"
            gap={10}
          >
            <Logo size="xl" />

            <StringInput
              id="name"
              label="Name"
              value={formik.values.name}
              onChange={(value: string) => formik.setFieldValue("name", value)}
              onBlur={() => formik.setFieldTouched("name", true)}
            />
            {formik.errors.name && <div className={styles.errorText}>{formik.errors.name}</div>}

            <BaseInput
              dimensionX="fill"
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
                onChange={event => formik.setFieldValue("password", event.target.value)}
                onBlur={() => formik.setFieldTouched("password", true)}
                type="password"
              />
            </BaseInput>
            {formik.errors.password && (
              <div className={styles.errorText}>{formik.errors.password}</div>
            )}

            <Button fullWidth type="submit">
              <Icon name="login" />
              Login
            </Button>

            <Button
              fullWidth
              type="button"
              color="default"
              variant="outlined"
              containerProps={{
                className: styles.spicaButton
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
          >
            <Button
              variant="icon"
              type="button"
              className={styles.linkButtons}
              onClick={() =>
                window.open("https://spicaengine.com/docs/start/getting-started", "_blank")
              }
            >
              <Icon name="article" />
              Document
            </Button>
            <Button
              variant="icon"
              type="button"
              className={styles.linkButtons}
              onClick={() => window.open("https://github.com/spica-engine/spica", "_blank")}
            >
              <Icon name="github" />
              Github
            </Button>
          </FlexElement>
        </FlexElement>
      </form>
    </div>
  );
};

export default memo(Login);
