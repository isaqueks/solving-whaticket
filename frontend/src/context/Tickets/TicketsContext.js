import React, { useState, useEffect, createContext } from "react";
import { useHistory } from "react-router-dom";

const TicketsContext = createContext();

const TicketsContextProvider = ({ children }) => {
	const [currentTicket, setCurrentTicket] = useState({ id: null, code: null });
    const history = useHistory();

    useEffect(() => {
        if (currentTicket.id !== null) {
            // Chamado #95: ao abrir a conversa a partir de um resultado da busca
            // de mensagens, leva junto a mensagem a focar
            const { focusMessageId } = currentTicket;
            history.push(
                focusMessageId
                    ? {
                        pathname: `/tickets/${currentTicket.uuid}`,
                        state: { focusMessageId, focusTicketId: currentTicket.id },
                    }
                    : `/tickets/${currentTicket.uuid}`
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTicket])

	return (
		<TicketsContext.Provider
			value={{ currentTicket, setCurrentTicket }}
		>
			{children}
		</TicketsContext.Provider>
	);
};

export { TicketsContext, TicketsContextProvider };
