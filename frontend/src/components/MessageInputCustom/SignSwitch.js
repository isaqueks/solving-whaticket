import React from "react";

import { isWidthUp } from "@material-ui/core/withWidth";
import { FormControlLabel, Switch } from "@material-ui/core";

import { i18n } from "../../translate/i18n";

/** Toggle de assinatura da mensagem (só em telas md+), movido tal-qual. */
export const SignSwitch = (props) => {
  const { width, setSignMessage, signMessage } = props;
  if (isWidthUp("md", width)) {
    return (
      <FormControlLabel
        style={{ marginRight: 7, color: "gray" }}
        label={i18n.t("messagesInput.signMessage")}
        labelPlacement="start"
        control={
          <Switch
            size="small"
            checked={signMessage}
            onChange={(e) => {
              setSignMessage(e.target.checked);
            }}
            name="showAllTickets"
            color="primary"
          />
        }
      />
    );
  }
  return null;
};
