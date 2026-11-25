import React from "react";

import { Avatar, CardHeader } from "@material-ui/core";

import { i18n } from "../../translate/i18n";

const TicketInfo = ({ contact, ticket, onClick }) => {
	const { user } = ticket
	// calculado a cada render (sem estado) para o cabeçalho acompanhar a troca
	// de atendente que chega via socket; em tela estreita mostra só o nome
	const isNarrow = document.body.offsetWidth < 600;

	let contactName = contact?.name || '';
	if (isNarrow && contactName.length > 10) {
		contactName = contactName.substring(0, 10) + '...';
	}

	let userName = '';
	if (user && contact) {
		userName = isNarrow
			? `${user.name}`
			: `${i18n.t("messagesList.header.assignedTo")} ${user.name}`;
	}

	return (
		<CardHeader
			onClick={onClick}
			style={{ cursor: "pointer" }}
			titleTypographyProps={{ noWrap: true }}
			subheaderTypographyProps={{ noWrap: true }}
			avatar={<Avatar src={contact.profilePicUrl} alt="contact_image" />}
			title={`${contactName} #${ticket.id}`}
			subheader={ticket.user && `${userName}`}
		/>
	);
};

export default TicketInfo;
