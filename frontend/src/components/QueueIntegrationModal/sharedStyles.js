import { makeStyles } from "@material-ui/core/styles";

/**
 * Estilo compartilhado pelos grupos de campos por tipo de integração
 * (Dialogflow, N8N/Webhook, Typebot). Só a chave usada por mais de um
 * consumidor mora aqui (doc 04 §10); `textField` é exatamente o do useStyles
 * original do index.js.
 */
export const useSharedIntegrationStyles = makeStyles((theme) => ({
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },
}));
