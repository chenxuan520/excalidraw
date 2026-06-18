import React from "react";
import {
  loginIcon,
  ExportIcon,
  LibraryIcon,
} from "../../packages/excalidraw/components/icons";
import { getShortcutFromShortcutName } from "../../packages/excalidraw/actions/shortcuts";
import type { Theme } from "../../packages/excalidraw/element/types";
import { useI18n } from "../../packages/excalidraw/i18n";
import { MainMenu } from "../../packages/excalidraw/index";
import { AlignmentAidsSettingsIcon } from "./AlignmentAidsSettings";
import { LanguageList } from "../app-language/LanguageList";
import { SequenceDiagramMenuIcon } from "../sequence/SequenceDiagramSidebar";

export const AppMainMenu: React.FC<{
  loggedIn: boolean;
  remoteDirty: boolean;
  theme: Theme | "system";
  setTheme: (theme: Theme | "system") => void;
  onOpenAlignmentAidsSettings: () => void;
  onOpenLogin: () => void;
  onOpenManager: () => void;
  onOpenSequenceDiagram: () => void;
  onSave: () => void;
  onLogout: () => void;
}> = React.memo((props) => {
  const { t } = useI18n();

  return (
    <MainMenu>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      {!props.loggedIn ? (
        <MainMenu.Item icon={loginIcon} onSelect={props.onOpenLogin}>
          {t("webdav.topRight.onlineMode")}
        </MainMenu.Item>
      ) : (
        <>
          <MainMenu.Item icon={ExportIcon} onSelect={props.onSave}>
            {props.remoteDirty
              ? t("webdav.topRight.saveDirty")
              : t("webdav.topRight.save")}
          </MainMenu.Item>
          <MainMenu.Item icon={LibraryIcon} onSelect={props.onOpenManager}>
            {t("webdav.topRight.manageFiles")}
          </MainMenu.Item>
          <MainMenu.Item icon={loginIcon} onSelect={props.onLogout}>
            {t("webdav.topRight.logout")}
          </MainMenu.Item>
        </>
      )}
      <MainMenu.Item
        icon={SequenceDiagramMenuIcon}
        onSelect={props.onOpenSequenceDiagram}
      >
        {t("sequenceDiagram.menu")}
      </MainMenu.Item>
      <MainMenu.Item
        icon={AlignmentAidsSettingsIcon}
        onSelect={props.onOpenAlignmentAidsSettings}
        shortcut={getShortcutFromShortcutName("openSettings")}
      >
        {t("buttons.settings")}
      </MainMenu.Item>
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.Separator />
      <MainMenu.DefaultItems.Socials />
      <MainMenu.Separator />
      <MainMenu.DefaultItems.ToggleTheme
        allowSystemTheme
        theme={props.theme}
        onSelect={props.setTheme}
      />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
