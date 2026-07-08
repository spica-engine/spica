import React from "react";
import type {RelationColumn} from "./primaryFieldUtils";
import styles from "./RelationColumns.module.scss";

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(" ");

type RelationColumnsProps = {
  id: string;
  columns?: RelationColumn[];
  className?: string;
};

/**
 * Renders a related entry as a compact multi-column row `[ _id | primary(s) ]`
 * so a relation is identifiable by its id plus the bucket's primary field(s),
 * rather than a single ambiguous label. Falls back to the `_id` column alone
 * when no primary field resolves.
 */
const RelationColumns: React.FC<RelationColumnsProps> = ({id, columns, className}) => (
  <span className={cx(styles.relationColumns, className)}>
    <span className={styles.idColumn} title={id}>
      {id}
    </span>
    {columns?.map(column => (
      <span key={column.key} className={styles.primaryColumn} title={column.value}>
        {column.value}
      </span>
    ))}
  </span>
);

export default React.memo(RelationColumns);
