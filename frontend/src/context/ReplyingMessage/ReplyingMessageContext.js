import React, { useState, createContext } from "react";

const ReplyMessageContext = createContext();

const ReplyMessageProvider = ({ children }) => {
	const [replyingMessage, setReplyingMessage] = useState(null);
	const [editingMessage, setEditingMessage] = useState(null);

	return (
		<ReplyMessageContext.Provider
			value={{ replyingMessage, setReplyingMessage, editingMessage, setEditingMessage }}
		>
			{children}
		</ReplyMessageContext.Provider>
	);
};

export { ReplyMessageContext, ReplyMessageProvider };
