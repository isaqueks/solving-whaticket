import React from "react";

import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import { Grid } from "@material-ui/core";
import { AttachFile, DeleteOutline } from "@material-ui/icons";

/**
 * Bloco de exibição do anexo da fila: nome do arquivo (anexo novo ou mídia já
 * salva) e o botão de remoção. Renderizado apenas quando há anexo. Espelha o
 * CampaignAttachmentInfo (F2b).
 */
const QueueAttachmentInfo = ({ queue, attachment, queueEditable, onDelete }) => {
  if (!queue.mediaPath && !attachment) return null;

  return (
    <Grid xs={12} item>
      <Button startIcon={<AttachFile />}>
        {attachment != null
          ? attachment.name
          : queue.mediaName}
      </Button>
      {queueEditable && (
        <IconButton
          onClick={onDelete}
          color="secondary"
        >
          <DeleteOutline />
        </IconButton>
      )}
    </Grid>
  );
};

export default QueueAttachmentInfo;
