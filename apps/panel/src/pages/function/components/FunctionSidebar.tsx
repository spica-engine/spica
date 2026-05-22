import PanelAccordion, {PanelAccordionItem} from "../../../components/molecules/panel-accordion/PanelAccordion";
import type {Enqueuer, FunctionTrigger, ResolvedEnvVar, ResolvedSecret} from "../../../store/api/functionApi";
import DependencyPanel from "./DependencyPanel";
import EnvironmentPanel from "./EnvironmentPanel";
import FunctionSidebarSaveButton from "./FunctionSidebarSaveButton";
import ImportedFunctionPanel from "./ImportedFunctionPanel";
import TriggerPanel from "./TriggerPanel";
import styles from "./FunctionSidebar.module.scss";

type FunctionSidebarProps = {
  showSidebar: boolean;
  code: string;
  functionId: string;
  triggers: FunctionTrigger[];
  enqueuers: Enqueuer[];
  handlers: string[];
  envVars: ResolvedEnvVar[];
  secrets: ResolvedSecret[];
  hasChanges: boolean;
  isSaving: boolean;
  hasUnsavedCodeChanges: boolean;
  onCodeChange: (value: string) => void;
  onTriggersChange: (triggers: FunctionTrigger[]) => void;
  onEnvVarsChange: (envVars: ResolvedEnvVar[]) => void;
  onSecretsChange: (secrets: ResolvedSecret[]) => void;
  onSave: () => void;
};

const FunctionSidebar = ({
  showSidebar,
  code,
  functionId,
  triggers,
  enqueuers,
  handlers,
  envVars,
  secrets,
  hasChanges,
  isSaving,
  hasUnsavedCodeChanges,
  onCodeChange,
  onTriggersChange,
  onEnvVarsChange,
  onSecretsChange,
  onSave,
}: FunctionSidebarProps) => {
  const isSaveDisabled = (!hasChanges && !hasUnsavedCodeChanges) || isSaving;

  return (
    <div className={styles.root} aria-hidden={!showSidebar}>
      <div className={styles.content}>
        <PanelAccordion>
          <PanelAccordionItem header="Imported Functions" defaultOpen>
            <ImportedFunctionPanel code={code} onCodeChange={onCodeChange} currentFunctionId={functionId} />
          </PanelAccordionItem>
          <PanelAccordionItem header="Triggers" defaultOpen>
            <TriggerPanel triggers={triggers} enqueuers={enqueuers} handlers={handlers} onChange={onTriggersChange} />
          </PanelAccordionItem>
          <PanelAccordionItem header="Dependencies" defaultOpen>
            <DependencyPanel functionId={functionId} />
          </PanelAccordionItem>
          <PanelAccordionItem header="Environment" defaultOpen>
            <EnvironmentPanel
              envVars={envVars}
              secrets={secrets}
              onEnvVarsChange={onEnvVarsChange}
              onSecretsChange={onSecretsChange}
            />
          </PanelAccordionItem>
        </PanelAccordion>
      </div>
      <div className={styles.saveButtonContainer}>
        <FunctionSidebarSaveButton disabled={isSaveDisabled} loading={isSaving} onClick={onSave} />
      </div>
    </div>
  );
};

export default FunctionSidebar;