import React from "react";

import { i18n } from "../../translate/i18n";
import Grid from "@material-ui/core/Grid";
import { makeStyles } from "@material-ui/core/styles";
import { Tabs, Tab } from "@material-ui/core";

import SettingField from "./SettingField";
import useSettingsState from "./useSettingsState";
import {
  generalSettings,
  ixcSettings,
  mkauthSettings,
  asaasSettings,
} from "./settingsSchema";

const useStyles = makeStyles((theme) => ({
  tab: {
    backgroundColor: theme.palette.options, //DARK MODE PLW DESIGN//
    borderRadius: 4,
    width: "100%",
    "& .MuiTab-wrapper": {
      color: theme.palette.fontecor,
    }, //DARK MODE PLW DESIGN//
    "& .MuiTabs-flexContainer": {
      justifyContent: "center"
    }
  },
}));

export default function Options(props) {
  const { settings, scheduleTypeChanged } = props;
  const classes = useStyles();

  const { values, loadingKeys, updateSetting } = useSettingsState(settings);

  // Efeitos colaterais por chave que dependem de props do componente.
  const sideEffects = {
    scheduleType: (value) => {
      if (typeof scheduleTypeChanged === "function") {
        scheduleTypeChanged(value);
      }
    },
  };

  const renderField = (field) => (
    <SettingField
      key={field.key}
      field={field}
      value={values[field.key]}
      loading={loadingKeys[field.key]}
      onChange={(value) =>
        updateSetting(field.key, value, {
          toastOptions: field.toastOptions,
          onChanged: sideEffects[field.key],
        })
      }
    />
  );

  return (
    <>
      <Grid spacing={3} container>
        {generalSettings.map(renderField)}
      </Grid>
      <Grid spacing={3} container>
        <Tabs
          indicatorColor="primary"
          textColor="primary"
          scrollButtons="on"
          variant="scrollable"
          className={classes.tab}
          style={{
            marginBottom: 20,
            marginTop: 20
          }}
        >
          <Tab label={i18n.t("settings.options.integrations")} />
        </Tabs>
      </Grid>
      {/*-----------------IXC-----------------*/}
      <Grid spacing={3} container style={{ marginBottom: 10 }}>
        <Tabs
          indicatorColor="primary"
          textColor="primary"
          scrollButtons="on"
          variant="scrollable"
          className={classes.tab}
        >
          <Tab label="IXC" />
        </Tabs>
        {ixcSettings.map(renderField)}
      </Grid>
      {/*-----------------MK-AUTH-----------------*/}
      <Grid spacing={3} container style={{ marginBottom: 10 }}>
        <Tabs
          indicatorColor="primary"
          textColor="primary"
          scrollButtons="on"
          variant="scrollable"
          className={classes.tab}
        >
          <Tab label="MK-AUTH" />
        </Tabs>
        {mkauthSettings.map(renderField)}
      </Grid>
      {/*-----------------ASAAS-----------------*/}
      <Grid spacing={3} container style={{ marginBottom: 10 }}>
        <Tabs
          indicatorColor="primary"
          textColor="primary"
          scrollButtons="on"
          variant="scrollable"
          className={classes.tab}
        >
          <Tab label="ASAAS" />
        </Tabs>
        {asaasSettings.map(renderField)}
      </Grid>
    </>
  );
}
