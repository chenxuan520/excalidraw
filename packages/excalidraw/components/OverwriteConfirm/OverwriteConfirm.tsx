import React from "react";
import { useAtom } from "jotai";

import { useTunnels } from "../../context/tunnels";
import { jotaiScope } from "../../jotai";
import { Dialog } from "../Dialog";
import { withInternalFallback } from "../hoc/withInternalFallback";
import { overwriteConfirmStateAtom } from "./OverwriteConfirmState";

import { FilledButton } from "../FilledButton";
import { alertTriangleIcon } from "../icons";
import { Actions, Action } from "./OverwriteConfirmActions";
import "./OverwriteConfirm.scss";

export type OverwriteConfirmDialogProps = {
  children: React.ReactNode;
};

const OverwriteConfirmDialog = Object.assign(
  withInternalFallback(
    "OverwriteConfirmDialog",
    ({ children }: OverwriteConfirmDialogProps) => {
      const { OverwriteConfirmDialogTunnel } = useTunnels();
      const [overwriteConfirmState, setState] = useAtom(
        overwriteConfirmStateAtom,
        jotaiScope,
      );

      if (!overwriteConfirmState.active) {
        return null;
      }

      const handleResolve = (result: "confirm" | "cancel" | "save-to-cloud") => {
        overwriteConfirmState.onResolve(result);
        setState({ active: false });
      };

      return (
        <OverwriteConfirmDialogTunnel.In>
          <Dialog
            onCloseRequest={() => handleResolve("cancel")}
            title={false}
            size={916}
          >
            <div className="OverwriteConfirm">
              <h3>{overwriteConfirmState.title}</h3>
              <div
                className={`OverwriteConfirm__Description OverwriteConfirm__Description--color-${overwriteConfirmState.color}`}
              >
                <div className="OverwriteConfirm__Description__icon">
                  {alertTriangleIcon}
                </div>
                <div>{overwriteConfirmState.description}</div>
                <div className="OverwriteConfirm__Description__spacer"></div>
                <FilledButton
                  color={overwriteConfirmState.color}
                  size="large"
                  label={overwriteConfirmState.actionLabel}
                  onClick={() => handleResolve("confirm")}
                />
              </div>
              <Actions>
                {children}
                {overwriteConfirmState.actions?.map((action) => (
                  <Action
                    key={action.key}
                    title={action.title}
                    actionLabel={action.actionLabel}
                    onClick={() => handleResolve(action.key)}
                  >
                    {action.description}
                  </Action>
                ))}
              </Actions>
            </div>
          </Dialog>
        </OverwriteConfirmDialogTunnel.In>
      );
    },
  ),
  {
    Actions,
    Action,
  },
);

export { OverwriteConfirmDialog };
