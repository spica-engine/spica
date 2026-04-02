import React, { useCallback, useState } from "react";
import { Drawer, FlexElement, Text } from "oziko-ui-kit";
import { useGetConfigsQuery } from "../../store/api/configApi";
import type { ConfigItem } from "../../store/api/configApi";
import Page from "../../components/organisms/page-layout/Page";
import ConfigForm from "./ConfigForm";
import styles from "./Config.module.scss";

function getConfigSummary(config: ConfigItem): string {
  const keys = Object.keys(config.options || {});
  if (keys.length === 0) return "No options configured";
  return `${keys.length} option${keys.length > 1 ? "s" : ""}: ${keys.join(", ")}`;
}

const Config = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<ConfigItem | null>(null);

  const { data: configs, isLoading, error } = useGetConfigsQuery();

  const handleOpenDrawer = useCallback((config: ConfigItem) => {
    setSelectedConfig(config);
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedConfig(null);
  }, []);

  return (
    <Page title="CONFIGURATIONS">
      <FlexElement
        dimensionX="fill"
        direction="horizontal"
        alignment="leftTop"
        gap={0}
        className={styles.configContainer}
      >
        {isLoading && (
          <>
            {Array.from({ length: 3 }).map((_, index) => (
              <FlexElement
                key={index}
                dimensionX="fill"
                direction="horizontal"
                className={styles.skeletonItem}
              >
                {" "}
              </FlexElement>
            ))}
          </>
        )}

        {error && (
          <Text variant="danger">Error loading configurations. Please try again.</Text>
        )}

        {!isLoading && !error && (!configs || configs.length === 0) && (
          <Text>No configurations available.</Text>
        )}

        {!isLoading &&
          !error &&
          configs?.map((config) => (
            <FlexElement
              key={config.module}
              dimensionX="fill"
              direction="vertical"
              gap={4}
              className={styles.configItem}
              onClick={() => handleOpenDrawer(config)}
            >
              <Text className={styles.configItemTitle}>{config.module}</Text>
              <Text className={styles.configItemMeta}>
                {getConfigSummary(config)}
              </Text>
            </FlexElement>
          ))}
      </FlexElement>

      <Drawer
        placement="right"
        size={600}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        showCloseButton={false}
      >
        <ConfigForm
          isOpen={isDrawerOpen}
          selectedConfig={selectedConfig}
          onClose={handleCloseDrawer}
        />
      </Drawer>
    </Page>
  );
};

export default Config;
