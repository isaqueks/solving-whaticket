import React from "react";

import Autocomplete, {
	createFilterOptions,
} from "@material-ui/lab/Autocomplete";
import TextField from "@material-ui/core/TextField";
import CircularProgress from "@material-ui/core/CircularProgress";
import { Grid } from "@material-ui/core";
import Typography from "@material-ui/core/Typography";

import { i18n } from "../../translate/i18n";

const filter = createFilterOptions({
  trim: true,
});

/**
 * Autocomplete de busca/seleção de contato do NewTicketModal. Só é renderizado
 * quando não veio um `initialContact` fixo (mesma condição do original). A opção
 * "adicionar novo contato" e a formatação de label/opção vivem aqui; a lógica de
 * seleção e de salvar ficam no index via callbacks.
 */
const ContactSearchAutocomplete = ({
  initialContact,
  options,
  loading,
  searchParam,
  selectedContact,
  onSearchChange,
  onSelectOption,
  onSubmit,
}) => {
  const createAddContactOption = (filterOptions, params) => {
    const filtered = filter(filterOptions, params);
    if (params.inputValue !== "" && !loading && searchParam.length >= 3) {
      filtered.push({
        name: `${params.inputValue}`,
      });
    }
    return filtered;
  };

  const renderOption = option => {
    if (option.number) {
      return <>
        {/* {IconChannel(option.channel)} */}
        <Typography component="span" style={{ fontSize: 14, marginLeft: "10px", display: "inline-flex", alignItems: "center", lineHeight: "2" }}>
          {option.name} - {option.number}
        </Typography>
      </>
    } else {
      return `${i18n.t("newTicketModal.add")} ${option.name}`;
    }
  };

  const renderOptionLabel = option => {
    if (option.number) {
      return `${option.name} - ${option.number}`;
    } else {
      return `${option.name}`;
    }
  };

  if (initialContact === undefined || initialContact.id === undefined) {
    return (
      <Grid xs={12} item>
        <Autocomplete
          fullWidth
          options={options}
          loading={loading}
          clearOnBlur
          autoHighlight
          freeSolo
          clearOnEscape
          getOptionLabel={renderOptionLabel}
          renderOption={renderOption}
          filterOptions={createAddContactOption}
          onChange={(e, newValue) => onSelectOption(e, newValue)}
          renderInput={params => (
            <TextField
              {...params}
              label={i18n.t("newTicketModal.fieldLabel")}
              variant="outlined"
              autoFocus
              onChange={e => onSearchChange(e.target.value)}
              onKeyPress={e => {
                if (loading || !selectedContact) return;
                else if (e.key === "Enter") {
                  onSubmit(selectedContact.id);
                }
              }}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <React.Fragment>
                    {loading ? (
                      <CircularProgress color="inherit" size={20} />
                    ) : null}
                    {params.InputProps.endAdornment}
                  </React.Fragment>
                ),
              }}
            />
          )}
        />
      </Grid>
    )
  }
  return null;
};

export default ContactSearchAutocomplete;
