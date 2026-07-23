import { makeStyles } from "@material-ui/core";

/**
 * Estilos usados por MAIS de um subcomponente do MessagesList (MessageBubble,
 * QuotedMessage e MessageMediaPreview). Uma definição, vários consumidores
 * (doc 04 §10) — os valores são exatamente os do useStyles original do
 * index.js; estilos de consumidor único vivem no arquivo do componente.
 */
export const useSharedMessageStyles = makeStyles(() => ({
  messageContactName: {
    display: "flex",
    color: "#6bcbef",
    fontWeight: 500,
  },

  messageMedia: {
    objectFit: "cover",
    width: 250,
    height: 200,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },

  downloadMedia: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "inherit",
    padding: 10,
  },
}));
