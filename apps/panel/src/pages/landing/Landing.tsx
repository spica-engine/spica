import React from "react";
import {BaseInput, Button, FlexElement, Icon, Input, StringInput, Text} from "oziko-ui-kit";
import styles from "./Landing.module.scss";
import logoSmall from "../../assets/images/logo_small.svg";
import logo from "../../assets/images/logo.svg";
import "oziko-ui-kit/dist/index.css";

const Landing = () => {
  return (
    <div className={styles.container}>
      <FlexElement direction="vertical" gap={5}>
        <FlexElement
          className={styles.contentContainer}
          dimensionX={400}
          direction="vertical"
          gap={10}
        >
          <img src={logo} alt="logo"></img>
          <StringInput label="Name"></StringInput>
          <BaseInput
            dimensionX={"fill"}
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
            <Input value={""} onChange={() => {}} />
          </BaseInput>
          <Button fullWidth>
            <Icon name="login"></Icon>
            Login
          </Button>
          <Button
            fullWidth
            color="default"
            variant="outlined"
            containerProps={{
              className: styles.spicaButton
            }}
          >
            <img src={logoSmall} alt="logo"></img>
            Login With Spica Account
          </Button>
        </FlexElement>
        <FlexElement
          alignment="rightCenter"
          dimensionX={"fill"}
          className={styles.bottomContainer}
          dimensionY={16}
        >
          <Button variant="icon" className={styles.linkButtons}>
            <Icon name="article"></Icon>
            Document
          </Button>
          <Button variant="icon" className={styles.linkButtons}>
            <Icon name="github"></Icon>
            Github
          </Button>
        </FlexElement>
      </FlexElement>
    </div>
  );
};

export default Landing;
