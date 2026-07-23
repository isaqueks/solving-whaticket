import React from "react";

import { makeStyles } from "@material-ui/core";
import { CheckCircle, RadioButtonUnchecked } from "@material-ui/icons";

const useSelectStyles = makeStyles((theme) => ({
  messageWrapper: {
    display: "grid",
    gridTemplateColumns: '40px 1fr',
    width: "100%",
    "&:hover .message-checkbox": {
      opacity: 0.7,
    },
  },
  messageCheckbox: {
    opacity: 0,
    transition: "opacity 0.2s ease-in-out",
    cursor: "pointer",
    zIndex: 10,
    padding: "4px",
    display: 'grid',
    "&.visible": {
      opacity: 1,
    },
    "&.selected": {
      opacity: 1,
      color: "#00bfa5",
    },
    '& *': {
      display: 'grid',
      margin: 'auto'
    }
  },
  selectedMessage: {
    backgroundColor: "rgba(0, 191, 165, 0.08) !important",
    "&::before": {
      content: '""',
      position: "absolute",
      left: "-20px",
      top: 0,
      bottom: 0,
      width: "4px",
      backgroundColor: "#00bfa5",
      borderRadius: "0 2px 2px 0",
    },
  },
  messageContent: {
  },
}));

/**
 * Wrapper de seleção para encaminhamento (máx. 6 mensagens). Movido tal-qual
 * do index.js do MessagesList.
 */
export function MessageSelect({
  children,
  isSelectionEnabled,
  selectedList,
  setSelectedList,
  message
}) {

  const classes = useSelectStyles();

  const isSelected = !!selectedList.find(msg => msg.id === message.id);

  const handleSelect = (e) => {
    e.stopPropagation();
    if (isSelected) {
      setSelectedList(selectedList.filter(({ id }) => id !== message.id));
    } else {
      if (selectedList.length >= 6)
        return;
      setSelectedList([...selectedList, message]);
    }
  };

  const handleMessageClick = (e) => {
    if (isSelectionEnabled) {
      e.preventDefault();
      handleSelect(e);
    }
  };

  if (!isSelectionEnabled) {
    return <>{children}</>;
  }

  return (
    <div
      className={`${classes.messageWrapper} ${isSelected ? classes.selectedMessage : ''}`}
      onClick={handleMessageClick}
    >
      <div
        className={`${classes.messageCheckbox} message-checkbox ${isSelectionEnabled ? 'visible' : ''
          } ${isSelected ? 'selected' : ''}`}
        onClick={handleSelect}
      >
        {isSelected ? (
          <CheckCircle style={{ fontSize: 22, color: "#00bfa5" }} />
        ) : (
          <RadioButtonUnchecked style={{ fontSize: 22, color: "#54656f" }} />
        )}
      </div>
      <div className={classes.messageContent}>
        {children}
      </div>
    </div>
  );
}
