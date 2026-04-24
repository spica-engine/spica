import React, { useCallback, useState } from "react";
import { Drawer, FlexElement, Text } from "oziko-ui-kit";
import { useGetConfigsQuery, useGetConfigSchemasQuery } from "../../store/api/configApi";
import type { ConfigItem } from "../../store/api/configApi";
import Page from "../../components/organisms/page-layout/Page";
import ConfigForm from "./ConfigForm";
import styles from "./Config.module.scss";

function getConfigSummary(config: ConfigItem | undefined): string {
  if (!config) return "Not configured yet";
  const keys = Object.keys(config.options || {});
  if (keys.length === 0) return "No options configured";
  return `${keys.length} option${keys.length > 1 ? "s" : ""}: ${keys.join(", ")}`;
}

const Config = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<ConfigItem | null>(null);

  const { data: schemas, isLoading: schemasLoading } = useGetConfigSchemasQuery();
  const { data: configs, isLoading: configsLoading } = useGetConfigsQuery();

  const isLoading = schemasLoading || configsLoading;

  const modules = schemas ? Object.keys(schemas) : [];
  const configByModule = configs
    ? Object.fromEntries(configs.map(c => [c.module, c]))
    : {};

  const handleOpenDrawer = useCallback((moduleName: string) => {
    const existing = configByModule[moduleName];
    setSelectedConfig(existing ?? { module: moduleName, options: {} } as ConfigItem);
    setIsDrawerOpen(true);
  }, [configByModule]);

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

        {!isLoading && modules.length === 0 && (
          <Text>No configurations available.</Text>
        )}

        {!isLoading &&
          modules.map((moduleName) => (
            <FlexElement
              key={moduleName}
              dimensionX="fill"
              direction="vertical"
              gap={4}
              className={styles.configItem}
              onClick={() => handleOpenDrawer(moduleName)}
            >
              <Text className={styles.configItemTitle}>{moduleName}</Text>
              <Text className={styles.configItemMeta}>
                {getConfigSummary(configByModule[moduleName])}
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
