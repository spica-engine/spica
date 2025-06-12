import React, {memo} from "react";
import {BaseInput, Button, FlexElement, Icon, Input, StringInput, Text} from "oziko-ui-kit";
import styles from "./LoginForm.module.scss";
import Logo from "../../atoms/logo/Logo";

type TypeLoginForm = {
  identifier: string;
  password: string;
  isLoading: boolean;
  loginError: string;
  onIdentifierChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
};

const LoginForm: React.FC<TypeLoginForm> = ({
  identifier,
  password,
  isLoading,
  loginError,
  onIdentifierChange,
  onPasswordChange,
  onSubmit
}) => {
  return (
    <FlexElement direction="vertical" gap={5}>
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
          value={identifier}
          onChange={onIdentifierChange}
        />

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
            value={password}
            onChange={event => onPasswordChange(event.target.value)}
            type="password"
          />
        </BaseInput>

        <Button
          fullWidth
          type="submit"
          disabled={identifier.length < 3 || password.length < 3 || isLoading}
          onClick={onSubmit}
        >
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
        dimensionX="fill"
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
  );
};

export default memo(LoginForm);
