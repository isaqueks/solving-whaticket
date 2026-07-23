import React from "react";

import { Field } from "formik";

import TextField from "@material-ui/core/TextField";
import { Box, Grid, Tab, Tabs } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  tabmsg: {
    backgroundColor: theme.palette.campaigntab,
  },
}));

/**
 * Abas de mensagens da campanha (Msg. 1 a 5, com variante de confirmação).
 * As cinco abas eram blocos JSX copiados; aqui a diferença (o índice da
 * mensagem) é parametrizada — mesmo render, sem duplicação (doc 04, §10).
 */
const CampaignMessageTabs = ({
  values,
  messageTab,
  setMessageTab,
  campaignEditable,
  status,
}) => {
  const classes = useStyles();

  const renderMessageField = (identifier) => (
    <Field
      as={TextField}
      id={identifier}
      name={identifier}
      fullWidth
      rows={5}
      label={i18n.t(`campaigns.dialog.form.${identifier}`)}
      placeholder={i18n.t("campaigns.dialog.form.messagePlaceholder")}
      multiline={true}
      variant="outlined"
      helperText="Utilize variáveis como {nome}, {numero}, {email} ou defina variáveis personalziadas."
      disabled={!campaignEditable && status !== "CANCELADA"}
    />
  );

  const renderConfirmationMessageField = (identifier) => (
    <Field
      as={TextField}
      id={identifier}
      name={identifier}
      fullWidth
      rows={5}
      label={i18n.t(`campaigns.dialog.form.${identifier}`)}
      placeholder={i18n.t("campaigns.dialog.form.messagePlaceholder")}
      multiline={true}
      variant="outlined"
      disabled={!campaignEditable && status !== "CANCELADA"}
    />
  );

  const renderMessagePanel = (index) => {
    const messageField = `message${index + 1}`;
    const confirmationField = `confirmationMessage${index + 1}`;

    if (values.confirmation) {
      return (
        <Grid spacing={2} container>
          <Grid xs={12} md={8} item>
            <>{renderMessageField(messageField)}</>
          </Grid>
          <Grid xs={12} md={4} item>
            <>{renderConfirmationMessageField(confirmationField)}</>
          </Grid>
        </Grid>
      );
    }

    return <>{renderMessageField(messageField)}</>;
  };

  return (
    <Grid xs={12} item>
      <Tabs
        value={messageTab}
        indicatorColor="primary"
        textColor="primary"
        className={classes.tabmsg}
        onChange={(e, v) => setMessageTab(v)}
        variant="fullWidth"
        centered
        style={{
          borderRadius: 2,
        }}
      >
        <Tab label="Msg. 1" index={0} />
        <Tab label="Msg. 2" index={1} />
        <Tab label="Msg. 3" index={2} />
        <Tab label="Msg. 4" index={3} />
        <Tab label="Msg. 5" index={4} />
      </Tabs>
      <Box style={{ paddingTop: 20, border: "none" }}>
        {[0, 1, 2, 3, 4].map(
          (index) =>
            messageTab === index && (
              <React.Fragment key={index}>
                {renderMessagePanel(index)}
              </React.Fragment>
            )
        )}
      </Box>
    </Grid>
  );
};

export default CampaignMessageTabs;
