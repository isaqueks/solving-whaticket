import React from "react";

import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";

// Chamado #92 (Solving): abre a conversa do contato no WhatsApp Web, em aba
// nova, para a atendente falar ou ligar pelo WhatsApp que estiver logado no
// navegador dela. O número do contato já é gravado com DDI, só com dígitos.
export const whatsAppWebUrl = number => {
	const digits = String(number || "").replace(/\D/g, "");
	if (digits.length < 10 || digits.length > 15) return null;
	return `https://web.whatsapp.com/send?phone=${digits}`;
};

const WhatsAppWebButton = ({ contact, size = "medium" }) => {
	if (!contact || contact.isGroup) return null;

	const url = whatsAppWebUrl(contact.number);
	if (!url) return null;

	return (
		<Tooltip title="Abrir no WhatsApp Web">
			<IconButton
				component="a"
				href={url}
				target="_blank"
				rel="noopener noreferrer"
				size={size}
				aria-label={`Abrir ${contact.number} no WhatsApp Web`}
				onClick={e => e.stopPropagation()}
				style={{ color: "#25a244" }}
			>
				<WhatsAppIcon fontSize={size === "small" ? "small" : "default"} />
			</IconButton>
		</Tooltip>
	);
};

export default WhatsAppWebButton;
