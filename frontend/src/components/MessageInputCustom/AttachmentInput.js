import React from "react";

import { makeStyles } from "@material-ui/core/styles";
import IconButton from "@material-ui/core/IconButton";
import AttachFileIcon from "@material-ui/icons/AttachFile";

import { useSharedInputStyles } from "./sharedStyles";

const useStyles = makeStyles(() => ({
  uploadInput: {
    display: "none",
  },
}));

/** Input de arquivo escondido + botão de anexo (era o FileInput inline). */
export const AttachmentInput = (props) => {
  const { handleChangeMedias, disableOption } = props;
  const classes = useStyles();
  const sharedClasses = useSharedInputStyles();
  return (
    <>
      <input
        multiple
        type="file"
        id="upload-button"
        disabled={disableOption()}
        className={classes.uploadInput}
        onChange={handleChangeMedias}
      />
      <label htmlFor="upload-button">
        <IconButton
          aria-label="upload"
          component="span"
          disabled={disableOption()}
        >
          <AttachFileIcon className={sharedClasses.sendMessageIcons} />
        </IconButton>
      </label>
    </>
  );
};
