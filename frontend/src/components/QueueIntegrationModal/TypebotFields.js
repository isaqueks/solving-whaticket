import React from "react";

import { Field } from "formik";
import { Grid, TextField } from "@material-ui/core";

import { i18n } from "../../translate/i18n";

import { useSharedIntegrationStyles } from "./sharedStyles";

/**
 * Grupo de campos do tipo Typebot (nome, URL, slug, expiração, delay e as
 * mensagens/keywords de fluxo). Renderizado apenas quando
 * `values.type === "typebot"`.
 */
const TypebotFields = ({ touched, errors }) => {
  const classes = useSharedIntegrationStyles();

  return (
    <>
      <Grid item xs={12} md={6} xl={6} >
        <Field
          as={TextField}
          label={i18n.t("queueIntegrationModal.form.name")}
          autoFocus
          name="name"
          error={touched.name && Boolean(errors.name)}
          helpertext={touched.name && errors.name}
          variant="outlined"
          margin="dense"
          required
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
      <Grid item xs={12} md={6} xl={6} >
        <Field
          as={TextField}
          label={i18n.t("queueIntegrationModal.form.typebotSlug")}
          name="typebotSlug"
          error={touched.typebotSlug && Boolean(errors.typebotSlug)}
          helpertext={touched.typebotSlug && errors.typebotSlug}
          required
          variant="outlined"
          margin="dense"
          fullWidth
          className={classes.textField}
        />
      </Grid>
      <Grid item xs={12} md={6} xl={6} >
        <Field
          as={TextField}
          label={i18n.t("queueIntegrationModal.form.typebotExpires")}
          name="typebotExpires"
          error={touched.typebotExpires && Boolean(errors.typebotExpires)}
          helpertext={touched.typebotExpires && errors.typebotExpires}
          variant="outlined"
          margin="dense"
          fullWidth
          className={classes.textField}
        />
      </Grid>
      <Grid item xs={12} md={6} xl={6} >
        <Field
          as={TextField}
          label={i18n.t("queueIntegrationModal.form.typebotDelayMessage")}
          name="typebotDelayMessage"
          error={touched.typebotDelayMessage && Boolean(errors.typebotDelayMessage)}
          helpertext={touched.typebotDelayMessage && errors.typebotDelayMessage}
          variant="outlined"
          margin="dense"
          fullWidth
          className={classes.textField}
        />
      </Grid>
      <Grid item xs={12} md={6} xl={6} >
        <Field
          as={TextField}
          label={i18n.t("queueIntegrationModal.form.typebotKeywordFinish")}
          name="typebotKeywordFinish"
          error={touched.typebotKeywordFinish && Boolean(errors.typebotKeywordFinish)}
          helpertext={touched.typebotKeywordFinish && errors.typebotKeywordFinish}
          variant="outlined"
          margin="dense"
          fullWidth
          className={classes.textField}
        />
      </Grid>
      <Grid item xs={12} md={6} xl={6} >
        <Field
          as={TextField}
          label={i18n.t("queueIntegrationModal.form.typebotKeywordRestart")}
          name="typebotKeywordRestart"
          error={touched.typebotKeywordRestart && Boolean(errors.typebotKeywordRestart)}
          helpertext={touched.typebotKeywordRestart && errors.typebotKeywordRestart}
          variant="outlined"
          margin="dense"
          fullWidth
          className={classes.textField}
        />
      </Grid>
      <Grid item xs={12} md={6} xl={6} >
        <Field
          as={TextField}
          label={i18n.t("queueIntegrationModal.form.typebotUnknownMessage")}
          name="typebotUnknownMessage"
          error={touched.typebotUnknownMessage && Boolean(errors.typebotUnknownMessage)}
          helpertext={touched.typebotUnknownMessage && errors.typebotUnknownMessage}
          variant="outlined"
          margin="dense"
          fullWidth
          className={classes.textField}
        />
      </Grid>
      <Grid item xs={12} md={12} xl={12} >
        <Field
          as={TextField}
          label={i18n.t("queueIntegrationModal.form.typebotRestartMessage")}
          name="typebotRestartMessage"
          error={touched.typebotRestartMessage && Boolean(errors.typebotRestartMessage)}
          helpertext={touched.typebotRestartMessage && errors.typebotRestartMessage}
          variant="outlined"
          margin="dense"
          fullWidth
          className={classes.textField}
        />
      </Grid>

    </>
  );
};

export default TypebotFields;
