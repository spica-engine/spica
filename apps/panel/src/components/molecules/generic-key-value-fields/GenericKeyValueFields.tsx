import {StringInput, Text} from "oziko-ui-kit";
import styles from "../schema-field-shared.module.scss";

type GenericKeyValueFieldsProps = {
  options: Record<string, unknown>;
  setOptions: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
};

const GenericKeyValueFields = ({options, setOptions}: GenericKeyValueFieldsProps) => {
  const keys = Object.keys(options);

  return (
    <>
      {keys.length === 0 && <Text>No options configured.</Text>}
      {keys.map(key => (
        <div key={key} className={styles.fieldRow}>
          <div className={styles.fieldInfo}>
            <span className={styles.fieldLabel} style={{textTransform: "capitalize"}}>
              {key.replace(/([A-Z])/g, " $1")}
            </span>
          </div>
          <div className={styles.fieldInput}>
            <StringInput
              label=""
              value={String(options[key] ?? "")}
              onChange={v => setOptions(prev => ({...prev, [key]: v}))}
            />
          </div>
        </div>
      ))}
    </>
  );
};

export default GenericKeyValueFields;
