import {
  BooleanInput,
  Button,
  FlexElement,
  Icon,
  Select,
  StringInput,
  TextAreaInput
} from "oziko-ui-kit";
import "oziko-ui-kit/dist/index.css";

const WebhookAdd = () => {
  return (
    <FlexElement direction="vertical" gap={10} dimensionX={"fill"}>
      <StringInput label="Name" onChange={() => {}} />
      <StringInput label="Url" onChange={() => {}} />
      <TextAreaInput placeholder="{{{ toJSON this }}}" />
      <Select value={"Collection*"} options={[]} onChange={() => {}} />
      <Select
        value={"Type*"}
        options={["INSERT", "UPDATE", "DELETE", "REPLACE"]}
        onChange={() => {}}
      />
      <BooleanInput label="Active" onChange={() => {}} />
      <FlexElement dimensionX={"fill"} alignment="rightCenter">
        <Button onClick={() => {}}>
          <Icon name="save"></Icon>
          Save
        </Button>
      </FlexElement>
    </FlexElement>
  );
};

export default WebhookAdd;
