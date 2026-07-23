import React from "react";

import Badge from "@material-ui/core/Badge";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(() => ({
  connectionTag: {
    background: "green",
    color: "#FFF",
    padding: "3px 7px",
    borderRadius: 5,
    fontSize: "0.75rem",
    whiteSpace: "nowrap",
  },
}));

/**
 * Chips informativos do card de ticket: usuário responsável (quando houver) e
 * fila. Renderizados dentro do bloco de conteúdo secundário do item.
 */
const TicketBadges = ({ ticketUser, ticket }) => {
  const classes = useStyles();

  return (
    <>
      {ticketUser && (
        <Badge
          style={{ backgroundColor: "#000" }}
          className={classes.connectionTag}
        >
          {ticketUser}
        </Badge>
      )}
      <Badge
        style={{
          backgroundColor: ticket.queue?.color || "#7c7c7c",
        }}
        className={classes.connectionTag}
      >
        {ticket.queue?.name?.toUpperCase() || "SEM FILA"}
      </Badge>
    </>
  );
};

export default TicketBadges;
