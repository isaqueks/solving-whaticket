import { makeStyles } from "@material-ui/core/styles";

/**
 * Estilos usados por vários subcomponentes do MessageInputCustom
 * (EmojiPickerPopover, AttachmentInput, ActionButtons, ReplyingMessageBar,
 * ForwardingView, MediaUploadView). Uma definição, vários consumidores
 * (doc 04 §10) — valores idênticos aos do useStyles original do index.js.
 */
export const useSharedInputStyles = makeStyles(() => ({
  sendMessageIcons: {
    color: "grey",
  },

  viewMediaInputWrapper: {
    display: "flex",
    padding: "10px 13px",
    position: "relative",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#eee",
    borderTop: "1px solid rgba(0, 0, 0, 0.12)",
  },
}));
