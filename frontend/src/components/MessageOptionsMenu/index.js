import React, { useState, useContext } from "react";

import MenuItem from "@material-ui/core/MenuItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import DeleteIcon from "@material-ui/icons/Delete";
import EditIcon from "@material-ui/icons/Edit";
import ForwardIcon from "@material-ui/icons/Forward";
import ReplyIcon from "@material-ui/icons/Reply";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ConfirmationModal from "../ConfirmationModal";
import { Menu } from "@material-ui/core";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import toastError from "../../errors/toastError";

const MessageOptionsMenu = ({ message, menuOpen, handleClose, anchorEl }) => {
	const {
		setReplyingMessage,
		setEditingMessage,
		setIsForwarding,
		setSelectedForwardMessages
	} = useContext(ReplyMessageContext);
	const [confirmationOpen, setConfirmationOpen] = useState(false);

	const handleDeleteMessage = async () => {
		try {
			await api.delete(`/messages/${message.id}`);
		} catch (err) {
			toastError(err);
		}
	};

	const handleEditMessage = async () => {
		setEditingMessage(message);
		handleClose();
	}

	const handleForwardMessage = async () => {
		setIsForwarding(true);
		setSelectedForwardMessages([message]);
		handleClose();
	};

	const hanldeReplyMessage = () => {
		setReplyingMessage(message);
		handleClose();
	};

	const handleOpenConfirmationModal = e => {
		setConfirmationOpen(true);
		handleClose();
	};

	return (
		<>
			<ConfirmationModal
				title={i18n.t("messageOptionsMenu.confirmationModal.title")}
				open={confirmationOpen}
				onClose={setConfirmationOpen}
				onConfirm={handleDeleteMessage}
			>
				{i18n.t("messageOptionsMenu.confirmationModal.message")}
			</ConfirmationModal>
			<Menu
				anchorEl={anchorEl}
				getContentAnchorEl={null}
				anchorOrigin={{
					vertical: "bottom",
					horizontal: "right",
				}}
				transformOrigin={{
					vertical: "top",
					horizontal: "right",
				}}
				open={menuOpen}
				onClose={handleClose}
			>
				{message.fromMe && <>
					<MenuItem onClick={handleOpenConfirmationModal}>
						<ListItemIcon>
							<DeleteIcon fontSize="small" />
						</ListItemIcon>
						{i18n.t("messageOptionsMenu.delete")}
					</MenuItem>
					{['extendedTextMessage', 'conversation'].includes(message.mediaType) && <MenuItem disabled={(Date.now() - new Date(message.createdAt)) > 15 * 60 * 1000} onClick={handleEditMessage}>
						<ListItemIcon>
							<EditIcon fontSize="small" />
						</ListItemIcon>
						Editar
					</MenuItem>}
				</>}
				<MenuItem onClick={handleForwardMessage}>
					<ListItemIcon>
						<ForwardIcon fontSize="small" />
					</ListItemIcon>
					Encaminhar
				</MenuItem>
				<MenuItem onClick={hanldeReplyMessage}>
					<ListItemIcon>
						<ReplyIcon fontSize="small" />
					</ListItemIcon>
					{i18n.t("messageOptionsMenu.reply")}
				</MenuItem>
			</Menu>
		</>
	);
};

export default MessageOptionsMenu;
