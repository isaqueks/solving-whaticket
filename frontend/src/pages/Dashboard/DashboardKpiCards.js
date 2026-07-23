import React from "react";

import { makeStyles } from "@material-ui/core/styles";
import MobileFriendlyIcon from "@material-ui/icons/MobileFriendly";
import StoreIcon from "@material-ui/icons/Store";
import CallIcon from "@material-ui/icons/Call";
import HourglassEmptyIcon from "@material-ui/icons/HourglassEmpty";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import GroupAddIcon from "@material-ui/icons/GroupAdd";
import AccessAlarmIcon from "@material-ui/icons/AccessAlarm";
import TimerIcon from "@material-ui/icons/Timer";

import moment from "moment";

import DashboardKpiCard from "./DashboardKpiCard";

const cardStyle = (theme, backgroundColor) => ({
  padding: theme.spacing(2),
  display: "flex",
  overflow: "auto",
  flexDirection: "column",
  height: "100%",
  backgroundColor,
  color: "#eee",
});

const useStyles = makeStyles((theme) => ({
  card0: cardStyle(theme, "#9400D3"),
  card00: cardStyle(theme, "#8B1C62"),
  card1: cardStyle(theme, "#11bf42"),
  card2: cardStyle(theme, "#748e9d"),
  card3: cardStyle(theme, "#e53935"),
  card4: cardStyle(theme, "#cc991b"),
  card8: cardStyle(theme, "#b05c38"),
  card9: cardStyle(theme, "#bd3c58"),
}));

const formatTime = (minutes) =>
  moment().startOf("day").add(minutes, "minutes").format("HH[h] mm[m]");

/**
 * Grupo de cards de KPI do Dashboard (doc 03, fase F2).
 *
 * Os 8 blocos de card, antes copiados no index (~350 linhas de JSX quase
 * idêntico), viram uma configuração data-driven renderizada por
 * DashboardKpiCard. Cards `superOnly` só aparecem para o super usuário.
 */
const DashboardKpiCards = ({ counters, user }) => {
  const classes = useStyles();

  const cards = [
    {
      classKey: "card0",
      superOnly: true,
      title: "Conexões Ativas",
      value: counters.totalWhatsappSessions,
      Icon: MobileFriendlyIcon,
      iconColor: "#fff",
      iconGridXs: 2,
      elevation: 4,
    },
    {
      classKey: "card00",
      superOnly: true,
      title: "Empresas",
      value: counters.totalCompanies,
      Icon: StoreIcon,
      iconColor: "#FF34B3",
      iconGridXs: 2,
      elevation: 4,
    },
    {
      classKey: "card1",
      title: "Em Conversa",
      value: counters.supportHappening,
      Icon: CallIcon,
      iconColor: "#0b708c",
      iconGridXs: 2,
      elevation: 4,
    },
    {
      classKey: "card2",
      title: "Aguardando",
      value: counters.supportPending,
      Icon: HourglassEmptyIcon,
      iconColor: "#47606e",
      iconGridXs: 4,
      elevation: 6,
    },
    {
      classKey: "card3",
      title: "Finalizados",
      value: counters.supportFinished,
      Icon: CheckCircleIcon,
      iconColor: "#5852ab",
      iconGridXs: 4,
      elevation: 6,
    },
    {
      classKey: "card4",
      title: "Novos Contatos",
      value: counters.leads,
      Icon: GroupAddIcon,
      iconColor: "#8c6b19",
      iconGridXs: 4,
      elevation: 6,
    },
    {
      classKey: "card8",
      title: "T.M. de Conversa",
      value: formatTime(counters.avgSupportTime),
      Icon: AccessAlarmIcon,
      iconColor: "#7a3f26",
      iconGridXs: 4,
      elevation: 6,
    },
    {
      classKey: "card9",
      title: "T.M. de Espera",
      value: formatTime(counters.avgWaitTime),
      Icon: TimerIcon,
      iconColor: "#8a2c40",
      iconGridXs: 4,
      elevation: 6,
    },
  ];

  return (
    <>
      {cards
        .filter((card) => !card.superOnly || user.super)
        .map((card) => (
          <DashboardKpiCard
            key={card.classKey}
            className={classes[card.classKey]}
            title={card.title}
            value={card.value}
            Icon={card.Icon}
            iconColor={card.iconColor}
            iconGridXs={card.iconGridXs}
            elevation={card.elevation}
          />
        ))}
    </>
  );
};

export default DashboardKpiCards;
