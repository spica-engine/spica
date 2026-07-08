import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Icon } from "oziko-ui-kit";
import SecretsTab from "./components/SecretsTab";
import VariablesTab from "./components/VariablesTab";
import styles from "./SecretsAndVariables.module.scss";

type TabType = "secrets" | "variables";

const TAB_ORDER: TabType[] = ["secrets", "variables"];
const DEFAULT_TAB: TabType = "secrets";
const BASE_PATH = "/passport/secrets-and-variables";

const SecretsAndVariables = () => {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeTab: TabType = TAB_ORDER.includes(tab as TabType) ? (tab as TabType) : DEFAULT_TAB;

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [secretsCount, setSecretsCount] = useState(0);
  const [variablesCount, setVariablesCount] = useState(0);

  // Redirect unknown tab slugs to the default so deep links can't render a blank view.
  useEffect(() => {
    if (tab && !TAB_ORDER.includes(tab as TabType)) {
      navigate(`${BASE_PATH}/${DEFAULT_TAB}`, { replace: true });
    }
  }, [tab, navigate]);

  const handleTabChange = useCallback((next: TabType) => {
    setIsNewOpen(false);
    navigate(`${BASE_PATH}/${next}`);
  }, [navigate]);

  const handleNew = useCallback(() => {
    setIsNewOpen(true);
  }, []);

  const handleNewClose = useCallback(() => {
    setIsNewOpen(false);
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div className={styles.pageSectionLabel}>Secrets and Variables</div>
        <p className={styles.pageDesc}>
          Secrets are encrypted and used for sensitive data. Variables are shown as plain text and are used for non-sensitive data.
        </p>
      </div>

      <div className={styles.tabsRow}>
        <div role="tablist" className={styles.tabs}>
          <button
            role="tab"
            type="button"
            aria-selected={activeTab === "secrets"}
            className={activeTab === "secrets" ? styles.tabActive : styles.tab}
            onClick={() => handleTabChange("secrets")}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Secrets
            <span className={styles.tabCount}>{secretsCount}</span>
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={activeTab === "variables"}
            className={activeTab === "variables" ? styles.tabActive : styles.tab}
            onClick={() => handleTabChange("variables")}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <polyline points="4 7 4 4 20 4 20 7" />
              <line x1="9" y1="20" x2="15" y2="20" />
              <line x1="12" y1="4" x2="12" y2="20" />
            </svg>
            Variables
            <span className={styles.tabCount}>{variablesCount}</span>
          </button>
        </div>
        <div className={styles.tabsActions}>
          <Button variant="solid" color="primary" onClick={handleNew}>
            <Icon name="plus" />
            New repository {activeTab === "secrets" ? "secret" : "variable"}
          </Button>
        </div>
      </div>

      <div className={styles.tabContent}>
        <div style={{ display: activeTab === "secrets" ? undefined : "none" }}>
          <SecretsTab
            isNewOpen={activeTab === "secrets" ? isNewOpen : false}
            onNewClose={handleNewClose}
            onCountChange={setSecretsCount}
          />
        </div>
        <div style={{ display: activeTab === "variables" ? undefined : "none" }}>
          <VariablesTab
            isNewOpen={activeTab === "variables" ? isNewOpen : false}
            onNewClose={handleNewClose}
            onCountChange={setVariablesCount}
          />
        </div>
      </div>
    </div>
  );
};

export default SecretsAndVariables;
