import React from "react";

import ContactTag from "../ContactTag";

/**
 * Tags personalizadas do ticket, renderizadas como chips (ContactTag) ao lado
 * dos badges de usuário/fila.
 */
const TicketTagChips = ({ tags, ticketId }) => {
  return (
    <>
      {tags?.map((tg) => {
        return (
          <ContactTag
            tag={tg}
            key={`ticket-contact-tag-${ticketId}-${tg.id}`}
          />
        );
      })}
    </>
  );
};

export default TicketTagChips;
