import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import { Button } from "@material-ui/core";
import AddIcon from "@material-ui/icons/Add";

import { useQueueOptions } from "./useQueueOptions";
import QueueOptionNode from "./QueueOptionNode";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    //height: 400,
    [theme.breakpoints.down("sm")]: {
      maxHeight: "20vh",
    },
  },
}));

export function QueueOptions({ queueId }) {
  const classes = useStyles();
  const { options, updateOptions, addOption } = useQueueOptions(queueId);

  const renderStepper = () => {
    if (options.length > 0) {
      return (
        <QueueOptionNode
          queueId={queueId}
          updateOptions={updateOptions}
          options={options}
        />
      );
    }
  };

  return (
    <div className={classes.root}>
      <br />
      <Typography>
        Opções
        <Button
          color="primary"
          size="small"
          onClick={addOption}
          startIcon={<AddIcon />}
          style={{ marginLeft: 10 }}
          variant="outlined"
        >
          Adicionar
        </Button>
      </Typography>
      {renderStepper()}
    </div>
  );
}
