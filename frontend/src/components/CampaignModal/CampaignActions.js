import React from "react";

import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import DialogActions from "@material-ui/core/DialogActions";
import { green } from "@material-ui/core/colors";
import { makeStyles } from "@material-ui/core/styles";

import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(() => ({
  btnWrapper: {
    position: "relative",
  },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
}));

/**
 * Barra de ações do CampaignModal (reiniciar / cancelar / anexar / fechar /
 * salvar). Apenas UI: recebe estado e callbacks; o index orquestra a lógica.
 */
const CampaignActions = ({
  campaign,
  campaignEditable,
  campaignId,
  attachment,
  isSubmitting,
  onRestart,
  onCancel,
  onAttach,
  onClose,
}) => {
  const classes = useStyles();

  return (
    <DialogActions>
      {campaign.status === "CANCELADA" && (
        <Button color="primary" onClick={onRestart} variant="outlined">
          {i18n.t("campaigns.dialog.buttons.restart")}
        </Button>
      )}
      {campaign.status === "EM_ANDAMENTO" && (
        <Button color="primary" onClick={onCancel} variant="outlined">
          {i18n.t("campaigns.dialog.buttons.cancel")}
        </Button>
      )}
      {!attachment && !campaign.mediaPath && campaignEditable && (
        <Button
          color="primary"
          onClick={onAttach}
          disabled={isSubmitting}
          variant="outlined"
        >
          {i18n.t("campaigns.dialog.buttons.attach")}
        </Button>
      )}
      <Button
        onClick={onClose}
        color="secondary"
        disabled={isSubmitting}
        variant="outlined"
      >
        {i18n.t("campaigns.dialog.buttons.close")}
      </Button>
      {(campaignEditable || campaign.status === "CANCELADA") && (
        <Button
          type="submit"
          color="primary"
          disabled={isSubmitting}
          variant="contained"
          className={classes.btnWrapper}
        >
          {campaignId
            ? `${i18n.t("campaigns.dialog.buttons.edit")}`
            : `${i18n.t("campaigns.dialog.buttons.add")}`}
          {isSubmitting && (
            <CircularProgress size={24} className={classes.buttonProgress} />
          )}
        </Button>
      )}
    </DialogActions>
  );
};

export default CampaignActions;
