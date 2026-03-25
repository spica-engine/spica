import React, { useCallback, useState } from "react";
import { Button, FlexElement, Icon, Text } from "oziko-ui-kit";
import Page from "../../components/organisms/page-layout/Page";
import SecretsTab from "./components/SecretsTab";
import VariablesTab from "./components/VariablesTab";
import styles from "./SecretsAndVariables.module.scss";

type TabType = "secrets" | "variables";

const SecretsAndVariables = () => {
  const [activeTab, setActiveTab] = useState<TabType>("secrets");

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  return (
    <Page title="SECRETS AND VARIABLES">
      <FlexElement dimensionX="fill" direction="vertical" gap={0} className={styles.container}>
        <FlexElement dimensionX="fill" alignment="leftTop" direction="vertical" gap={10}>
          <Text className={styles.description}>
            Secrets are encrypted and used for sensitive data. Variables are shown as plain text and are used for non-sensitive data.
          </Text>

          <FlexElement direction="horizontal" gap={0} className={styles.tabsHeader}>
            <div
              className={activeTab === "secrets" ? styles.tabActive : styles.tab}
              onClick={() => handleTabChange("secrets")}
            >
              <Text size="medium">Secrets</Text>
            </div>
            <div
              className={activeTab === "variables" ? styles.tabActive : styles.tab}
              onClick={() => handleTabChange("variables")}
            >
              <Text size="medium">Variables</Text>
            </div>
          </FlexElement>
        </FlexElement>

        {activeTab === "secrets" && <SecretsTab />}
        {activeTab === "variables" && <VariablesTab />}
      </FlexElement>
    </Page>
  );
};

export default SecretsAndVariables;
