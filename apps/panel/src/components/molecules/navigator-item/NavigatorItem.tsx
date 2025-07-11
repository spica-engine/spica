import React, {type FC, memo} from "react";
import styles from "./NavigatorItem.module.scss";
import {
  Button,
  Text,
  Icon,
  FluidContainer,
  type TypeFluidContainer,
  type IconName,
  type TypeButton
} from "oziko-ui-kit";

type SuffixIcon = {
  name: IconName;
  onClick?: () => void;
  ref?: React.Ref<HTMLButtonElement>;
};

type TypeNavigatorItem = {
  label: string;
  prefixIcon?: IconName;
  suffixIcons?: SuffixIcon[];
} & TypeFluidContainer;

const ButtonWithRef = Button as React.NamedExoticComponent<
  TypeButton & {ref: React.Ref<HTMLButtonElement> | undefined}
>;

const validIcons = [
  "article",
  "clockOutline",
  "login",
  "google",
  "facebook",
  "github",
  "sourceCommit",
  "check",
  "replay",
  "magnify",
  "bug",
  "callMerge",
  "mapMarker",
  "palette",
  "imageMultiple",
  "dataObject",
  "formatAlignCenter",
  "formatAlignLeft",
  "formatAlignRight",
  "formatAlignJustify",
  "formatListChecks",
  "formatQuoteClose",
  "numericBox",
  "calendarBlank",
  "checkboxBlankOutline",
  "security",
  "formatSize",
  "lock",
  "filter",
  "layers",
  "key",
  "accountCircle",
  "fileMultiple",
  "contentCopy",
  "swapHorizontal",
  "fileDocument",
  "folder",
  "fullscreen",
  "pencil",
  "chevronRight",
  "codeTags",
  "chevronDown",
  "notificationClearAll",
  "dragHorizontalVariant",
  "dotsHorizontal",
  "dotsVertical",
  "eye",
  "refresh",
  "plus",
  "delete",
  "minus",
  "close",
  "help",
  "cog",
  "identities",
  "assetstore",
  "dashboard",
  "bucket",
  "function",
  "webhook",
  "storage",
  "chevronLeft",
  "formatBold",
  "formatItalic",
  "formatUnderlined",
  "undo",
  "redo",
  "formatColorText",
  "formatColorFill",
  "strikethroughS",
  "webhook",
  "storage",
  "chevronLeft",
  "invertColors",
  "folderZip",
  "movie",
  "gridOn",
  "ballot",
  "gridView",
  "viewList",
  "sort",
  "forkRight",
  "filterCenterFocus",
  "save",
  "person"
];

const NavigatorItem: FC<TypeNavigatorItem> = ({label, prefixIcon, suffixIcons = [], ...props}) => {
  return (
    <FluidContainer
      dimensionX={"fill"}
      dimensionY={36}
      mode="fill"
      prefix={
        prefixIcon && {
          // TODO: <Icon /> should handle invalid IconName inputs internally.
          // It currently throws — consider adding a `fallback` prop or defaulting to a safe internal value.
          children: (
            <Icon name={validIcons.includes(prefixIcon) ? prefixIcon : "help"} size={"md"} />
          )
        }
      }
      root={{
        children: (
          <Text dimensionX={"fill"} size="medium" className={styles.label}>
            {label}
          </Text>
        )
      }}
      suffix={{
        children: suffixIcons.length > 0 && (
          <>
            {suffixIcons.map(({name, onClick, ref}, index) => (
              <ButtonWithRef
                key={index}
                color="transparent"
                className={styles.suffixButton}
                onClick={onClick}
                ref={ref}
              >
                <Icon name={name} size="sm" />
              </ButtonWithRef>
            ))}
          </>
        )
      }}
      {...props}
      className={`${styles.navigatorItem} ${props.className}`}
    />
  );
};

export default memo(NavigatorItem);
