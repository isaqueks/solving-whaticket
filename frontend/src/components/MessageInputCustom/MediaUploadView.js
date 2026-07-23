import React from "react";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import IconButton from "@material-ui/core/IconButton";
import CircularProgress from "@material-ui/core/CircularProgress";
import { green } from "@material-ui/core/colors";
import CancelIcon from "@material-ui/icons/Cancel";
import SendIcon from "@material-ui/icons/Send";

import { useSharedInputStyles } from "./sharedStyles";

const useStyles = makeStyles(() => ({
  circleLoading: {
    color: green[500],
    opacity: "70%",
    position: "absolute",
    top: "20%",
    left: "50%",
    marginLeft: -12,
  },
}));

/**
 * Barra de confirmação de anexos selecionados (substitui o input enquanto há
 * medias). JSX movido tal-qual do branch medias.length > 0 do index.js.
 */
export const MediaUploadView = (props) => {
  const { medias, setMedias, loading, handleUploadMedia } = props;

  const classes = useStyles();
  const sharedClasses = useSharedInputStyles();

  return (
    <Paper elevation={0} square className={sharedClasses.viewMediaInputWrapper}>
      <IconButton
        aria-label="cancel-upload"
        component="span"
        onClick={(e) => setMedias([])}
      >
        <CancelIcon className={sharedClasses.sendMessageIcons} />
      </IconButton>

      {loading ? (
        <div>
          <CircularProgress className={classes.circleLoading} />
        </div>
      ) : (
        <span>
          {medias[0]?.name}
        </span>
      )}
      <IconButton
        aria-label="send-upload"
        component="span"
        onClick={handleUploadMedia}
        disabled={loading}
      >
        <SendIcon className={sharedClasses.sendMessageIcons} />
      </IconButton>
    </Paper>
  );
};
