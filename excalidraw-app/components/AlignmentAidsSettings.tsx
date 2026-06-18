import { useEffect } from "react";
import { Dialog } from "../../packages/excalidraw/components/Dialog";
import { createIcon } from "../../packages/excalidraw/components/icons";
import { Switch } from "../../packages/excalidraw/components/Switch";
import { useUIAppState } from "../../packages/excalidraw/context/ui-appState";
import { useI18n } from "../../packages/excalidraw/i18n";
import { getShortcutFromShortcutName } from "../../packages/excalidraw/actions/shortcuts";
import { LanguageList } from "../app-language/LanguageList";

import "./AlignmentAidsSettings.scss";

export const AlignmentAidsSettingsIcon = createIcon(
  <g
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.97.59 2.296.07 2.572-1.065Z" />
    <circle cx="12" cy="12" r="3" />
  </g>,
  { width: 24, height: 24 },
);

type AlignmentAidsSettingsProps = {
  isOpen: boolean;
  onClose: () => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
};

export const AlignmentAidsSettingsTrigger = ({
  onOpen,
}: {
  onOpen: () => void;
}) => {
  const { t } = useI18n();
  const shortcut = getShortcutFromShortcutName("openSettings");

  return (
    <button
      className="help-icon"
      onClick={onOpen}
      type="button"
      title={`${t("buttons.settings")} — ${shortcut}`}
      aria-label={t("buttons.settings")}
    >
      {AlignmentAidsSettingsIcon}
    </button>
  );
};

export const AlignmentAidsSettings = ({
  isOpen,
  onClose,
  enabled,
  onEnabledChange,
}: AlignmentAidsSettingsProps) => {
  const { t } = useI18n();
  const openDialog = useUIAppState().openDialog;

  useEffect(() => {
    if (isOpen && openDialog) {
      onClose();
    }
  }, [isOpen, onClose, openDialog]);

  return (
    <>
      {isOpen && (
        <Dialog
          className="AlignmentAidsSettingsModal"
          size="small"
          title={t("buttons.settings")}
          onCloseRequest={onClose}
        >
          <div className="AlignmentAidsSettingsDialog">
            <section className="AlignmentAidsSettingsDialog__section">
              <h3 className="AlignmentAidsSettingsDialog__sectionTitle">
                {t("alignmentAidsDialog.general")}
              </h3>
              <div className="AlignmentAidsSettingsDialog__row AlignmentAidsSettingsDialog__row--stacked">
                <div className="AlignmentAidsSettingsDialog__copy">
                  <div className="AlignmentAidsSettingsDialog__label">
                    {t("labels.language")}
                  </div>
                  <p className="AlignmentAidsSettingsDialog__description">
                    {t("alignmentAidsDialog.languageDescription")}
                  </p>
                </div>
                <LanguageList style={{ width: "100%" }} />
              </div>
            </section>

            <section className="AlignmentAidsSettingsDialog__section">
              <h3 className="AlignmentAidsSettingsDialog__sectionTitle">
                {t("alignmentAidsDialog.drawing")}
              </h3>
              <div className="AlignmentAidsSettingsDialog__row">
                <div className="AlignmentAidsSettingsDialog__copy">
                  <div className="AlignmentAidsSettingsDialog__label">
                    {t("labels.alignmentAids")}
                  </div>
                  <p className="AlignmentAidsSettingsDialog__description">
                    {t("alignmentAidsDialog.alignmentDescription")}
                  </p>
                </div>
                <Switch
                  name="alignment-aids-enabled"
                  checked={enabled}
                  onChange={onEnabledChange}
                  title={t("labels.alignmentAids")}
                />
              </div>
            </section>
          </div>
        </Dialog>
      )}
    </>
  );
};
