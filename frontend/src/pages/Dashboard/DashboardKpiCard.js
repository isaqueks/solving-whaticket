import React from "react";

import Paper from "@material-ui/core/Paper";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";

/**
 * Card único de KPI do Dashboard (título + valor + ícone colorido).
 * Puramente visual — os 8 cards antes copiados no index viram uma configuração
 * (ver DashboardKpiCards) que alimenta este componente.
 */
const DashboardKpiCard = ({
  className,
  title,
  value,
  Icon,
  iconColor,
  iconGridXs,
  elevation,
}) => (
  <Grid item xs={12} sm={6} md={4}>
    <Paper className={className} style={{ overflow: "hidden" }} elevation={elevation}>
      <Grid container spacing={3}>
        <Grid item xs={8}>
          <Typography component="h3" variant="h6" paragraph>
            {title}
          </Typography>
          <Grid item>
            <Typography component="h1" variant="h4">
              {value}
            </Typography>
          </Grid>
        </Grid>
        <Grid item xs={iconGridXs}>
          <Icon
            style={{
              fontSize: 100,
              color: iconColor,
            }}
          />
        </Grid>
      </Grid>
    </Paper>
  </Grid>
);

export default DashboardKpiCard;
