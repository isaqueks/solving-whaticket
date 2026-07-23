import React from "react";

import { Field } from "formik";

import TextField from "@material-ui/core/TextField";
import {
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },
}));

/**
 * Bloco de campos de dados da campanha (nome, lista de contatos, tags,
 * conexão, agendamento e lista de arquivos). Puramente visual — recebe os
 * valores/estado do Formik e as listas auxiliares por props.
 */
const CampaignDataFields = ({
  values,
  touched,
  errors,
  campaignEditable,
  contactLists,
  tagLists,
  whatsapps,
  files,
}) => {
  const classes = useStyles();

  return (
    <>
      <Grid xs={12} item>
        <Field
          as={TextField}
          label={i18n.t("campaigns.dialog.form.name")}
          name="name"
          error={touched.name && Boolean(errors.name)}
          helperText={touched.name && errors.name}
          variant="outlined"
          margin="dense"
          fullWidth
          className={classes.textField}
          disabled={!campaignEditable}
        />
      </Grid>
      {/* <Grid xs={12} md={3} item>
        <FormControl
          variant="outlined"
          margin="dense"
          fullWidth
          className={classes.formControl}
        >
          <InputLabel id="confirmation-selection-label">
            {i18n.t("campaigns.dialog.form.confirmation")}
          </InputLabel>
          <Field
            as={Select}
            label={i18n.t("campaigns.dialog.form.confirmation")}
            placeholder={i18n.t(
              "campaigns.dialog.form.confirmation"
            )}
            labelId="confirmation-selection-label"
            id="confirmation"
            name="confirmation"
            error={
              touched.confirmation && Boolean(errors.confirmation)
            }
            disabled={!campaignEditable}
          >
            <MenuItem value={false}>Desabilitada</MenuItem>
            <MenuItem value={true}>Habilitada</MenuItem>
          </Field>
        </FormControl>
      </Grid> */}
      <Grid xs={12} md={4} item>
        <FormControl
          variant="outlined"
          margin="dense"
          fullWidth
          className={classes.formControl}
        >
          <InputLabel id="contactList-selection-label">
            {i18n.t("campaigns.dialog.form.contactList")}
          </InputLabel>
          <Field
            as={Select}
            label={i18n.t("campaigns.dialog.form.contactList")}
            placeholder={i18n.t("campaigns.dialog.form.contactList")}
            labelId="contactList-selection-label"
            id="contactListId"
            name="contactListId"
            error={touched.contactListId && Boolean(errors.contactListId)}
            disabled={!campaignEditable}
          >
            <MenuItem value="">Nenhuma</MenuItem>
            {contactLists &&
              contactLists.map((contactList) => (
                <MenuItem key={contactList.id} value={contactList.id}>
                  {contactList.name}
                </MenuItem>
              ))}
          </Field>
        </FormControl>
      </Grid>
      <Grid xs={12} md={4} item>
        <FormControl
          variant="outlined"
          margin="dense"
          fullWidth
          className={classes.formControl}
        >
          <InputLabel id="tagList-selection-label">
            {i18n.t("campaigns.dialog.form.tagList")}
          </InputLabel>
          <Field
            as={Select}
            label={i18n.t("campaigns.dialog.form.tagList")}
            placeholder={i18n.t("campaigns.dialog.form.tagList")}
            labelId="tagList-selection-label"
            id="tagListId"
            name="tagListId"
            error={touched.tagListId && Boolean(errors.tagListId)}
            disabled={!campaignEditable}
          >
            <MenuItem value="">Nenhuma</MenuItem>
            {Array.isArray(tagLists) &&
              tagLists.map((tagList) => (
                <MenuItem key={tagList.id} value={tagList.id}>
                  {tagList.name}
                </MenuItem>
              ))}
          </Field>
        </FormControl>
      </Grid>
      <Grid xs={12} md={4} item>
        <FormControl
          variant="outlined"
          margin="dense"
          fullWidth
          className={classes.formControl}
        >
          <InputLabel id="whatsapp-selection-label">
            {i18n.t("campaigns.dialog.form.whatsapp")}
          </InputLabel>
          <Field
            as={Select}
            label={i18n.t("campaigns.dialog.form.whatsapp")}
            placeholder={i18n.t("campaigns.dialog.form.whatsapp")}
            labelId="whatsapp-selection-label"
            id="whatsappId"
            name="whatsappId"
            error={touched.whatsappId && Boolean(errors.whatsappId)}
            disabled={!campaignEditable}
          >
            <MenuItem value="">Nenhuma</MenuItem>
            {whatsapps &&
              whatsapps.map((whatsapp) => (
                <MenuItem key={whatsapp.id} value={whatsapp.id}>
                  {whatsapp.name}
                </MenuItem>
              ))}
          </Field>
        </FormControl>
      </Grid>
      <Grid xs={12} md={4} item>
        <Field
          as={TextField}
          label={i18n.t("campaigns.dialog.form.scheduledAt")}
          name="scheduledAt"
          error={touched.scheduledAt && Boolean(errors.scheduledAt)}
          helperText={touched.scheduledAt && errors.scheduledAt}
          variant="outlined"
          margin="dense"
          type="datetime-local"
          InputLabelProps={{
            shrink: true,
          }}
          fullWidth
          className={classes.textField}
          disabled={!campaignEditable}
        />
      </Grid>
      <Grid xs={12} md={4} item>
        <FormControl
          variant="outlined"
          margin="dense"
          className={classes.FormControl}
          fullWidth
        >
          <InputLabel id="fileListId-selection-label">
            {i18n.t("campaigns.dialog.form.fileList")}
          </InputLabel>
          <Field
            as={Select}
            label={i18n.t("campaigns.dialog.form.fileList")}
            name="fileListId"
            id="fileListId"
            placeholder={i18n.t("campaigns.dialog.form.fileList")}
            labelId="fileListId-selection-label"
            value={values.fileListId || ""}
          >
            <MenuItem value={""}>{"Nenhum"}</MenuItem>
            {Array.isArray(files) &&
              files.map((f) => (
                <MenuItem key={f.id} value={f.id}>
                  {f.name}
                </MenuItem>
              ))}
          </Field>
        </FormControl>
      </Grid>
    </>
  );
};

export default CampaignDataFields;
