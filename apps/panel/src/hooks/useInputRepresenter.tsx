import {Fragment, useCallback, type ReactNode} from "react";
import {
  ArrayInput,
  BooleanInput,
  ColorInput,
  DateInput,
  Icon,
  LocationInput,
  NumberInput,
  ObjectInput,
  RichTextInput,
  StorageInput,
  StringInput,
  TextAreaInput,
  type TypeCoordinates,
  apiUtil,
  Text
} from "oziko-ui-kit";
import ChipInput from "../components/atoms/chip-input/ChipInput";
import MultipleSelectionInput from "../components/molecules/multiple-selection/MultipleSelection";

export type TypeProperties = {
  [key: string]: {
    type: keyof typeof types;
    title: string;
    description?: string;
    options?: TypeOptions;
    enum?: (string | number)[];
    default?: TypeValueType;
    items?: TypeArrayItems;
    minItems?: number;
    maxItems?: number;
    locationType?: string;
    className?: string;
    properties?: TypeProperties;
    requires?: string;
  };
};

export type TypeValueType =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | boolean[]
  | TypeRepresenterValue
  | TypeRepresenterValue[];

export type TypeRepresenterValue = {
  [key: string]: TypeValueType | TypeRepresenterValue;
};

export type TypeInputType =
  | "string"
  | "number"
  | "textarea"
  | "date"
  | "boolean"
  | "color"
  | "storage"
  | "multiselect"
  | "location"
  | "richtext"
  | "object"
  | "array";

type TypeOptions = {
  position?: "top" | "bottom" | "left" | "right";
  index?: boolean;
};

export type TypeArrayItems = {
  title?: string;
  type: TypeInputType;
  properties: TypeProperties;
  enum?: (number | string)[];
};

export type TypeChangeEvent<T> = {
  key: string;
  value: T;
};

export type TypeInputProps<T> = {
  key: string;
  title: string;
  description: string;
  value?: T;
  className?: string;
  onChange?: ({key, value}: TypeChangeEvent<T>) => void;
};

export type TypeInputRepresenterError = {[key: string]: string | null};

type TypeObjectInputProps<T> = {
  key?: string;
  properties?: TypeProperties;
} & TypeInputProps<T>;

type TypeSelectInputProps<T extends string | number> = {
  enum?: T[];
} & TypeInputProps<T>;

type TypeMultiSelectInputProps<T extends string | number> = {
  enum?: T[];
} & TypeInputProps<T[]>;

type TypeArrayInputProps<T> = {
  minItems?: number;
  maxItems?: number;
  items?: TypeArrayItems;
} & TypeInputProps<T[]>;

export type TypeInputTypeMap = {
  string: (props: TypeSelectInputProps<string>) => ReactNode;
  number: (props: TypeSelectInputProps<number>) => ReactNode;
  textarea: (props: TypeInputProps<string>) => ReactNode;
  date: (props: TypeInputProps<Date | string | null>) => ReactNode;
  boolean: (props: TypeInputProps<boolean>) => ReactNode;
  color: (props: TypeInputProps<string>) => ReactNode;
  storage: (props: TypeInputProps<string>) => ReactNode;
  multiselect: (props: TypeMultiSelectInputProps<string | number>) => ReactNode;
  location: (props: TypeInputProps<TypeCoordinates | apiUtil.TypeLocation>) => ReactNode;
  richtext: (props: TypeInputProps<string>) => ReactNode;
  object: (props: TypeObjectInputProps<TypeRepresenterValue>) => ReactNode;
  array: (props: TypeArrayInputProps<TypeValueType>) => ReactNode;
  chip: (props: TypeInputProps<string[]>) => ReactNode;
};

const types: TypeInputTypeMap = {
  string: props => (
    <StringInput
      label={props.title}
      description={props.description}
      inputContainerClassName={props.className}
      value={props.value}
      options={props.enum}
      onChange={value => {
        props.onChange?.({key: props.key, value});
      }}
    />
  ),
  number: props => (
    <NumberInput
      label={props.title}
      description={props.description}
      inputContainerClassName={props.className}
      value={props.value}
      options={props.enum}
      onChange={value => props.onChange?.({key: props.key, value})}
    />
  ),
  textarea: props => (
    <TextAreaInput
      title={props.title}
      titlePrefixProps={{children: <Icon name="formatSize" />}}
      containerProps={{className: props.className}}
      value={props.value}
      onChange={event => props.onChange?.({key: props.key, value: event.target.value})}
    />
  ),
  date: props => (
    <DateInput
      label={props.title}
      description={props.description}
      inputContainerClassName={props.className}
      value={props.value}
      onChange={value => props.onChange?.({key: props.key, value})}
    />
  ),
  boolean: props => (
    <BooleanInput
      checked={props.value}
      label={props.title}
      description={props.description}
      containerProps={{dimensionX: "fill"}}
      onChange={value => props.onChange?.({key: props.key, value})}
    />
  ),
  color: props => (
    <ColorInput
      label={props.title}
      description={props.description}
      inputContainerClassName={props.className}
      value={props.value}
      onChange={value => props.onChange?.({key: props.key, value})}
    />
  ),
  storage: props => (
    <StorageInput
      onUpload={() => {}}
      label={props.title}
      containerProps={{
        className: props.className
      }}
    />
  ),
  multiselect: props => (
    <MultipleSelectionInput
      label={props.title}
      description={props.description}
      inputContainerClassName={props.className}
      value={props.value}
      options={props.enum}
      onChange={value => props.onChange?.({key: props.key, value})}
    />
  ),
  location: props => {
    if (apiUtil.isTypeLocation(props.value)) {
      const coordinates = props?.value.coordinates;
      props.value = {lat: coordinates[1], lng: coordinates[0]};
    }

    const handleChangeLocation = (value: TypeCoordinates) => {
      let normalizedValue: apiUtil.TypeLocation | TypeCoordinates = value;
      if (apiUtil.isTypeLocation(props.value)) {
        normalizedValue = {
          type: "Point",
          coordinates: [value.lng, value.lng]
        };
      }
      props.onChange?.({key: props.key, value: normalizedValue});
    };

    return (
      <LocationInput
        title={props.title}
        dimensionX="fill"
        coordinates={props.value as TypeCoordinates}
        onChange={handleChangeLocation}
      />
    );
  },
  richtext: props => (
    <RichTextInput
      headerProps={{label: props.title, icon: "formatAlignCenter"}}
      value={props.value}
      onChange={value => props.onChange?.({key: props.key, value})}
    />
  ),
  object: props => {
    return (
      <ObjectInput
        properties={props.properties! as any}
        title={props.title}
        description={props.description}
        value={props.value}
        onChange={value => {
          props.onChange?.({key: props.key, value});
        }}
      />
    );
  },
  array: props => {
    return (
      <ArrayInput
        title={props.title}
        description={props.description}
        value={props.value}
        onChange={value => props.onChange?.({key: props.title, value})}
        minItems={props.minItems}
        maxItems={props.maxItems}
        items={props.items as TypeArrayItems as any}
        propertyKey={props.key}
      />
    );
  },
  chip: props => {
    return (
      <ChipInput
        value={props.value ?? []}
        onChange={value => {
          props.onChange?.({key: props.key, value});
        }}
      />
    );
  }
};

type TypeUseInputRepresenter = {
  properties: TypeProperties;
  value?: TypeValueType | TypeRepresenterValue;
  error?: TypeInputRepresenterError;
  onChange?: (value: any) => void;
};

const isFalsy = (value: any) => {
  if (value === null || value === undefined) return true;
  if (typeof value === "boolean") return !value;
  if (typeof value === "number" && value === 0) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

const useInputRepresenter = ({properties, value, error, onChange}: TypeUseInputRepresenter) => {
  const handleChange = (event: {key: string; value: any}) => {
    const updatedValue: any = structuredClone(value);
    updatedValue[event.key] = event.value;
    onChange?.(updatedValue);
  };

  return Object.entries(properties).map(([key, el]) => {
    const isObject = typeof value === "object" && !Array.isArray(value);
    if (isObject && el.requires && isFalsy(value[el.requires])) {
      return;
    }
    const _value = isObject ? (value[key] ?? value) : value;
    const _error = error?.[key];

    return (
      <div style={{position: "relative", width: "100%"}} key={key}>
        {types[el.type]({
          key,
          title: el.title,
          description: el.description!,
          //@ts-ignore
          value: _value,
          className: el.className,
          properties: el.properties,
          enum: el.enum ?? (el.items?.enum as any),
          minItems: el.minItems,
          maxItems: el.maxItems,
          items: el.items,
          onChange: (event: any) => handleChange(event)
        })}
        {_error && (
          <Text
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              pointerEvents: "none",
              whiteSpace: "nowrap"
            }}
            size="xsmall"
            variant="danger"
          >
            {_error}
          </Text>
        )}
      </div>
    );
  });
};

export default useInputRepresenter;
