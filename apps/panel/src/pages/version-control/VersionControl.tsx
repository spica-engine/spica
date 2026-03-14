import {memo, useMemo} from "react";
import Page from "../../components/organisms/page-layout/Page";
import CommitHistoryTemplate from "../../components/templates/commit-history/CommitHistoryTemplate";
import TerminalTemplate from "../../components/templates/terminal/TerminalTemplate";
import {useLogQuery} from "../../store/api/versionControlApi";
import {groupCommitsByDate} from "../../utils/groupCommitsByDate";
import styles from "./VersionControl.module.scss";

const VersionControl = () => {
  const {data: logData, isLoading, isError} = useLogQuery({args: ["--since=3 days ago"]});

  const groups = useMemo(() => {
    if (!logData?.all) return [];
    return groupCommitsByDate(logData.all);
  }, [logData]);

  return (
    <div className={styles.container}>
      <div className={styles.terminalContent}>
        <TerminalTemplate />
      </div>
      <Page title="COMMITS (project-base branch)" className={styles.commitsContent}>
        {isLoading && <div className={styles.loadingState}>Loading commits...</div>}
        {isError && <div className={styles.errorState}>Failed to load commits.</div>}
        {!isLoading && !isError && groups.length === 0 && (
          <div className={styles.emptyState}>No commits found in the last 3 days.</div>
        )}
        {!isLoading && !isError && groups.length > 0 && (
          <CommitHistoryTemplate groups={groups} />
        )}
      </Page>
    </div>
  );
};

export default memo(VersionControl);
