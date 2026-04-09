import {FlexElement, FluidContainer, Icon, Text} from "oziko-ui-kit";
import styles from "../Navigation.module.scss";
import React from "react";
import {useNavigate, useParams} from "react-router-dom";
import {useGetConfigsQuery} from "../../../../store/api/configApi";

const FALLBACK_CONFIG_ITEMS = [
  {module: "user", label: "User"},
  {module: "versioncontrol", label: "Version Control"}
];

const ConfigNavigation = () => {
  const navigate = useNavigate();
  const {module: activeModule} = useParams<{module: string}>();
  const {data: configs, isLoading, error} = useGetConfigsQuery();

  const items =
    !isLoading && !error && configs && configs.length > 0
      ? configs.map(c => ({module: c.module, label: c.module}))
      : FALLBACK_CONFIG_ITEMS;

  return (
    <div className={styles.container}>
      <FluidContainer
        dimensionX="fill"
        mode="fill"
        className={styles.header}
        root={{
          children: (
            <Text dimensionX="fill" size="large">
              Configuration
            </Text>
          )
        }}
      />

      <FlexElement direction="vertical" dimensionX="fill">
        {isLoading &&
          Array.from({length: 2}).map((_, i) => (
            <FluidContainer
              key={i}
              dimensionX="fill"
              dimensionY={36}
              mode="fill"
              alignment="leftCenter"
              className={styles.defaultNavigationItem}
              root={{children: <Text size="medium">Loading...</Text>}}
            />
          ))}

        {!isLoading &&
          items.map(item => (
            <FluidContainer
              key={item.module}
              dimensionX="fill"
              dimensionY={36}
              mode="fill"
              alignment="leftCenter"
              className={styles.defaultNavigationItem}
              onClick={() => navigate(`/config/${item.module}`)}
              style={
                activeModule === item.module
                  ? {backgroundColor: "var(--color-hover)"}
                  : undefined
              }
              prefix={{
                children: <Icon name="cog" />
              }}
              root={{
                children: (
                  <Text dimensionX="fill" size="medium" style={{textTransform: "capitalize"}}>
                    {item.label}
                  </Text>
                )
              }}
            />
          ))}
      </FlexElement>
    </div>
  );
};

export default ConfigNavigation;
