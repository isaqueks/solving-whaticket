import React from "react";

import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import { Grid } from "@material-ui/core";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";

/**
 * Bloco de exibição do anexo da campanha: nome do arquivo (anexo novo ou
 * mídia já salva) e o botão de remoção. Renderizado apenas quando há anexo.
 */
const CampaignAttachmentInfo = ({ campaign, attachment, campaignEditable, onDelete }) => {
  if (!campaign.mediaPath && !attachment) return null;

  return (
    <Grid xs={12} item>
      <Button startIcon={<AttachFileIcon />}>
        {attachment != null ? attachment.name : campaign.mediaName}
      </Button>
      {campaignEditable && (
        <IconButton onClick={onDelete} color="secondary">
          <DeleteOutlineIcon />
        </IconButton>
      )}
    </Grid>
  );
};

export default CampaignAttachmentInfo;
