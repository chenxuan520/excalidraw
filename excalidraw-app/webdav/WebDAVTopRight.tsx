import { useI18n } from "../../packages/excalidraw/i18n";
import { ToolButton } from "../../packages/excalidraw/components/ToolButton";
import { Tooltip } from "../../packages/excalidraw/components/Tooltip";
import {
  LibraryIcon,
  loginIcon,
  publishIcon,
} from "../../packages/excalidraw/components/icons";

type WebDAVTopRightProps = {
  loggedIn: boolean;
  remoteDirty: boolean;
  isSaving: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onOpenManager: () => void;
  onSave: () => void;
};

export const WebDAVTopRight = ({
  loggedIn,
  remoteDirty,
  isSaving,
  onLogin,
  onLogout,
  onOpenManager,
  onSave,
}: WebDAVTopRightProps) => {
  const { t } = useI18n();
  const onlineModeLabel = t("webdav.topRight.onlineMode");
  const saveLabel = isSaving
    ? t("webdav.topRight.saving")
    : remoteDirty
    ? t("webdav.topRight.saveDirty")
    : t("webdav.topRight.save");
  const manageFilesLabel = t("webdav.topRight.manageFiles");
  const logoutLabel = t("webdav.topRight.logout");

  return (
    <div className="top-right-ui top-right-ui--webdav">
      {!loggedIn ? (
        <Tooltip label={onlineModeLabel}>
          <ToolButton
            type="icon"
            icon={loginIcon}
            aria-label={onlineModeLabel}
            onClick={onLogin}
          />
        </Tooltip>
      ) : (
        <>
          <Tooltip label={saveLabel}>
            <ToolButton
              type="icon"
              icon={publishIcon}
              aria-label={saveLabel}
              isLoading={isSaving}
              onClick={onSave}
            />
          </Tooltip>
          <Tooltip label={manageFilesLabel}>
            <ToolButton
              type="icon"
              icon={LibraryIcon}
              aria-label={manageFilesLabel}
              onClick={onOpenManager}
            />
          </Tooltip>
          <Tooltip label={logoutLabel}>
            <ToolButton
              type="icon"
              icon={loginIcon}
              aria-label={logoutLabel}
              onClick={onLogout}
            />
          </Tooltip>
        </>
      )}
    </div>
  );
};
