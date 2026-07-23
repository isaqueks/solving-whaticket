import React from "react";

import { Field } from "formik";
import { Grid, TextField } from "@material-ui/core";

import { i18n } from "../../translate/i18n";

import { useSharedIntegrationStyles } from "./sharedStyles";

/**
 * Grupo de campos dos tipos N8N e Webhook (nome + URL do fluxo). Ambos os tipos
 * usam exatamente os mesmos campos, por isso um só componente.
 */
const N8nWebhookFields = ({ touched, errors }) => {
  const classes = useSharedIntegrationStyles();

  return (
    <>
      <Grid item xs={12} md={6} xl={6} >
        <Field
          as={TextField}
          label={i18n.t("queueIntegrationModal.form.name")}
          autoFocus
          required
          name="name"
          error={touched.name && Boolean(errors.name)}
          helpertext={touched.name && errors.name}
          variant="outlined"
          margin="dense"
          fullWidth
          className={classes.textField}
        />
      </Grid>
      <Grid item xs={12} md={12} xl={12} >
        <Field
          as={TextField}
          label={i18n.t("queueIntegrationModal.form.urlN8N")}
          name="urlN8N"
          error={touched.urlN8N && Boolean(errors.urlN8N)}
          helpertext={touched.urlN8N && errors.urlN8N}
          variant="outlined"
          margin="dense"
          required
          fullWidth
          className={classes.textField}
        />
      </Grid>
    </>
  );
};

export default N8nWebhookFields;
