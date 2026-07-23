import React from "react";

import { i18n } from "../../translate/i18n";
import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import FormHelperText from "@material-ui/core/FormHelperText";
import TextField from "@material-ui/core/TextField";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(() => ({
  selectContainer: {
    width: "100%",
    textAlign: "left",
  },
}));

/**
 * Campo genérico de configuração (doc 03, fase F2).
 *
 * Renderiza um `select` ou um `text` a partir do descriptor em `settingsSchema`.
 * Não conhece persistência: dispara `onChange(value)` e o hook cuida do resto.
 */
const SettingField = ({ field, value, loading, onChange }) => {
  const classes = useStyles();
  const { type, gridProps, label, labelId, options, key } = field;

  return (
    <Grid item {...gridProps}>
      <FormControl className={classes.selectContainer}>
        {type === "select" ? (
          <>
            <InputLabel id={labelId}>{label}</InputLabel>
            <Select
              labelId={labelId}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            >
              {options.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </>
        ) : (
          <TextField
            id={key}
            name={key}
            margin="dense"
            label={label}
            variant="outlined"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        <FormHelperText>
          {loading && i18n.t("settings.options.updating")}
        </FormHelperText>
      </FormControl>
    </Grid>
  );
};

export default SettingField;
