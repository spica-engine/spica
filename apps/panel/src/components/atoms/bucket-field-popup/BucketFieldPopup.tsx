import {memo, type FC} from "react";
import {FlexElement, ListItem, Icon} from "oziko-ui-kit";
import type {TypeFlexElement} from "../../../../../../node_modules/oziko-ui-kit/dist/components/atoms/flex-element/FlexElement";
import type {IconName} from "../../../../../../node_modules/oziko-ui-kit/dist/utils/iconList";
import type {TypeInputType} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import styles from "./BucketFieldPopup.module.scss";

const fieldOptions: {icon: IconName; text: string; type: TypeInputType}[] = [
  {icon: "formatQuoteClose", text: "String", type: "string"},
  {icon: "numericBox", text: "Number", type: "number"},
  {icon: "calendarBlank", text: "Date", type: "date"},
  {icon: "checkboxBlankOutline", text: "Boolean", type: "boolean"},
  {icon: "formatListChecks", text: "Multiple Selection", type: "multiselect"},
  {icon: "callMerge", text: "Relation", type: "storage"},
  {icon: "mapMarker", text: "Location", type: "location"},
  {icon: "ballot", text: "Array", type: "array"},
  {icon: "dataObject", text: "Object", type: "object"},
  {icon: "imageMultiple", text: "File", type: "storage"},
  {icon: "formatAlignCenter", text: "RichText", type: "richtext"}
];

const BucketFieldPopup: FC<TypeFlexElement> = () => {
  const handleClick = (type: TypeInputType) => {
    return type;
  };

  return (
    <FlexElement dimensionX={200} direction="vertical" className={styles.container}>
      {fieldOptions.map(({icon, text, type}) => (
        <ListItem
          key={text}
          label={text}
          dimensionX="fill"
          dimensionY="hug"
          gap={10}
          prefix={{children: <Icon name={icon} />}}
          onClick={() => handleClick(type)}
          className={styles.item}
        />
      ))}
    </FlexElement>
  );
};

export default memo(BucketFieldPopup);
