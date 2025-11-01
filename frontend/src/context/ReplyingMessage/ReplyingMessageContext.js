import React, { useState, createContext } from "react";

const ReplyMessageContext = createContext();

const ReplyMessageProvider = ({ children }) => {
	const [replyingMessage, setReplyingMessage] = useState(null);
	const [editingMessage, setEditingMessage] = useState(null);
	const [isForwarding, setIsForwarding] = useState(false);
	const [selectedForwardMessages, setSelectedForwardMessages] = useState([]);

	return (
		<ReplyMessageContext.Provider
			value={{ 
				replyingMessage, 
				setReplyingMessage, 
				editingMessage, 
				setEditingMessage, 
				isForwarding, 
				setIsForwarding, 
				selectedForwardMessages, 
				setSelectedForwardMessages 
			}}
		>
			{children}
		</ReplyMessageContext.Provider>
	);
};

export { ReplyMessageContext, ReplyMessageProvider };
