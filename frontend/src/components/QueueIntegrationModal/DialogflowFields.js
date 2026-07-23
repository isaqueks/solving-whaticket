import React from "react";

import { Field } from "formik";
import {
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@material-ui/core";

import { i18n } from "../../translate/i18n";

import { useSharedIntegrationStyles } from "./sharedStyles";

/**
 * Grupo de campos do tipo DialogFlow (nome, idioma, projeto e JSON de
 * credenciais). Renderizado apenas quando `values.type === "dialogflow"`.
 */
const DialogflowFields = ({ touched, errors }) => {
  const classes = useSharedIntegrationStyles();

  return (
    <>
      <Grid item xs={12} md={6} xl={6} >
        <Field
          as={TextField}
          label={i18n.t("queueIntegrationModal.form.name")}
          autoFocus
          name="name"
          fullWidth
          error={touched.name && Boolean(errors.name)}
          helpertext={touched.name && errors.name}
          variant="outlined"
          margin="dense"
          className={classes.textField}
        />
      </Grid>
      <Grid item xs={12} md={6} xl={6} >
        <FormControl
          variant="outlined"
          className={classes.formControl}
          margin="dense"
          fullWidth
        >
          <InputLabel id="language-selection-input-label">
            {i18n.t("queueIntegrationModal.form.language")}
          </InputLabel>

          <Field
            as={Select}
            label={i18n.t("queueIntegrationModal.form.language")}
            name="language"
            labelId="profile-selection-label"
            fullWidth
            error={touched.language && Boolean(errors.language)}
            helpertext={touched.language && errors.language}
            id="language-selection"
            required
          >
            <MenuItem value="pt-BR">Portugues</MenuItem>
            <MenuItem value="en">Inglês</MenuItem>
            <MenuItem value="es">Español</MenuItem>
          </Field>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={6} xl={6} >
        <Field
          as={TextField}
          label={i18n.t("queueIntegrationModal.form.projectName")}
          name="projectName"
          error={touched.projectName && Boolean(errors.projectName)}
          helpertext={touched.projectName && errors.projectName}
          fullWidth
          variant="outlined"
          margin="dense"
        />
      </Grid>
      <Grid item xs={12} md={12} xl={12} >
        <Field
          as={TextField}
          label={i18n.t("queueIntegrationModal.form.jsonContent")}
          type="jsonContent"
          multiline
          //inputRef={greetingRef}
          maxRows={5}
          minRows={5}
          fullWidth
          name="jsonContent"
          error={touched.jsonContent && Boolean(errors.jsonContent)}
          helpertext={touched.jsonContent && errors.jsonContent}
          variant="outlined"
          margin="dense"
        />
      </Grid>
    </>
  );
};

export default DialogflowFields;
