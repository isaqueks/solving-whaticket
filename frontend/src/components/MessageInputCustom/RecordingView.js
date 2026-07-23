import React from "react";

import { makeStyles } from "@material-ui/core/styles";
import IconButton from "@material-ui/core/IconButton";
import CircularProgress from "@material-ui/core/CircularProgress";
import { green } from "@material-ui/core/colors";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import HighlightOffIcon from "@material-ui/icons/HighlightOff";

import RecordingTimer from "./RecordingTimer";

const useStyles = makeStyles(() => ({
  recorderWrapper: {
    display: "flex",
    alignItems: "center",
    alignContent: "middle",
  },

  cancelAudioIcon: {
    color: "red",
  },

  sendAudioIcon: {
    color: "green",
  },

  audioLoading: {
    color: green[500],
    opacity: "70%",
  },
}));

/**
 * UI do estado "gravando áudio": cancelar, timer/spinner e enviar (era o
 * branch `recording` do ActionButtons inline do index.js).
 */
export const RecordingView = (props) => {
  const { loading, handleCancelAudio, handleUploadAudio } = props;
  const classes = useStyles();

  return (
    <div className={classes.recorderWrapper}>
      <IconButton
        aria-label="cancelRecording"
        component="span"
        fontSize="large"
        disabled={loading}
        onClick={handleCancelAudio}
      >
        <HighlightOffIcon className={classes.cancelAudioIcon} />
      </IconButton>
      {loading ? (
        <div>
          <CircularProgress className={classes.audioLoading} />
        </div>
      ) : (
        <RecordingTimer />
      )}

      <IconButton
        aria-label="sendRecordedAudio"
        component="span"
        onClick={handleUploadAudio}
        disabled={loading}
      >
        <CheckCircleOutlineIcon className={classes.sendAudioIcon} />
      </IconButton>
    </div>
  );
};
