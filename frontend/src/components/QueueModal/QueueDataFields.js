import React from "react";

import { Field } from "formik";
import { makeStyles } from "@material-ui/core/styles";
import TextField from "@material-ui/core/TextField";
import {
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
} from "@material-ui/core";
import { Colorize } from "@material-ui/icons";

import { i18n } from "../../translate/i18n";
import ColorPicker from "../ColorPicker";

const useStyles = makeStyles((theme) => ({
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },
  colorAdorment: {
    width: 20,
    height: 20,
  },
}));

/**
 * Campos da aba "Dados da Fila": nome, cor (com ColorPicker), ordem, integração
 * e as mensagens de saudação / fora de horário. Bloco visual do formulário
 * Formik — recebe values/touched/errors e os setters de que precisa; o index
 * mantém o shell (Formik/DialogContent/DialogActions). Espelha o
 * CampaignDataFields (F2b). JSX idêntico ao original do index.js.
 */
const QueueDataFields = ({
  values,
  touched,
  errors,
  integrations,
  schedulesEnabled,
  colorPickerModalOpen,
  setColorPickerModalOpen,
  greetingRef,
  setQueue,
}) => {
  const classes = useStyles();

  return (
    <>
      <Field
        as={TextField}
        label={i18n.t("queueModal.form.name")}
        autoFocus
        name="name"
        error={touched.name && Boolean(errors.name)}
        helperText={touched.name && errors.name}
        variant="outlined"
        margin="dense"
        className={classes.textField}
      />
      <Field
        as={TextField}
        label={i18n.t("queueModal.form.color")}
        name="color"
        id="color"
        onFocus={() => {
          setColorPickerModalOpen(true);
          greetingRef.current.focus();
        }}
        error={touched.color && Boolean(errors.color)}
        helperText={touched.color && errors.color}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <div
                style={{ backgroundColor: values.color }}
                className={classes.colorAdorment}
              ></div>
            </InputAdornment>
          ),
          endAdornment: (
            <IconButton
              size="small"
              color="default"
              onClick={() => setColorPickerModalOpen(true)}
            >
              <Colorize />
            </IconButton>
          ),
        }}
        variant="outlined"
        margin="dense"
        className={classes.textField}
      />
      <ColorPicker
        open={colorPickerModalOpen}
        handleClose={() => setColorPickerModalOpen(false)}
        onChange={(color) => {
          values.color = color;
          setQueue(() => {
            return { ...values, color };
          });
        }}
      />
      <Field
        as={TextField}
        label={i18n.t("queueModal.form.orderQueue")}
        name="orderQueue"
        type="orderQueue"
        error={touched.orderQueue && Boolean(errors.orderQueue)}
        helperText={touched.orderQueue && errors.orderQueue}
        variant="outlined"
        margin="dense"
        className={classes.textField1}
      />
      <div>
        <FormControl
          variant="outlined"
          margin="dense"
          className={classes.FormControl}
          fullWidth
        >
          <InputLabel id="integrationId-selection-label">
            {i18n.t("queueModal.form.integrationId")}
          </InputLabel>
          <Field
            as={Select}
            label={i18n.t("queueModal.form.integrationId")}
            name="integrationId"
            id="integrationId"
            placeholder={i18n.t("queueModal.form.integrationId")}
            labelId="integrationId-selection-label"
            value={values.integrationId || ""}
          >
            <MenuItem value={""} >{"Nenhum"}</MenuItem>
            {integrations.map((integration) => (
              <MenuItem key={integration.id} value={integration.id}>
                {integration.name}
              </MenuItem>
            ))}
          </Field>

        </FormControl>
      </div>
      <div style={{ marginTop: 5 }}>
        <Field
          as={TextField}
          label={i18n.t("queueModal.form.greetingMessage")}
          type="greetingMessage"
          multiline
          inputRef={greetingRef}
          rows={5}
          fullWidth
          name="greetingMessage"
          error={
            touched.greetingMessage &&
            Boolean(errors.greetingMessage)
          }
          helperText={
            touched.greetingMessage && errors.greetingMessage
          }
          variant="outlined"
          margin="dense"
        />
        {schedulesEnabled && (
          <Field
            as={TextField}
            label={i18n.t("queueModal.form.outOfHoursMessage")}
            type="outOfHoursMessage"
            multiline
            inputRef={greetingRef}
            rows={5}
            fullWidth
            name="outOfHoursMessage"
            error={
              touched.outOfHoursMessage &&
              Boolean(errors.outOfHoursMessage)
            }
            helperText={
              touched.outOfHoursMessage && errors.outOfHoursMessage
            }
            variant="outlined"
            margin="dense"
          />
        )}
      </div>
    </>
  );
};

export default QueueDataFields;
