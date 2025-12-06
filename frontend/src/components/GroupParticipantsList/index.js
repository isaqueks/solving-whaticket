import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import Avatar from "@material-ui/core/Avatar";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import ListItemText from "@material-ui/core/ListItemText";
import Chip from "@material-ui/core/Chip";
import CircularProgress from "@material-ui/core/CircularProgress";
import Paper from "@material-ui/core/Paper";
import { toast } from "react-toastify";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    maxHeight: "400px",
    overflowY: "auto",
    backgroundColor: theme.palette.background.paper,
    ...theme.scrollbarStyles,
  },
  participantItem: {
    padding: theme.spacing(1, 2),
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  avatar: {
    width: 40,
    height: 40,
    fontSize: "0.875rem",
  },
  adminChip: {
    marginLeft: theme.spacing(1),
    height: 20,
    fontSize: "0.7rem",
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.primary.contrastText,
  },
  superAdminChip: {
    marginLeft: theme.spacing(1),
    height: 20,
    fontSize: "0.7rem",
    backgroundColor: theme.palette.secondary.main,
    color: theme.palette.secondary.contrastText,
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing(3),
  },
  emptyState: {
    padding: theme.spacing(2),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  participantName: {
    fontWeight: 500,
  },
  participantNumber: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
  },
}));

const GroupParticipantsList = ({ contactId }) => {
  const classes = useStyles();
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (contactId) {
      loadParticipants();
    }
  }, [contactId]);

  const loadParticipants = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/contacts/${contactId}/participants`);
      setParticipants(data);
    } catch (err) {
      console.error("Erro ao carregar participantes:", err);
      toast.error("Erro ao carregar participantes do grupo");
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getParticipantName = (participant) => {
    return participant.participantContact?.name || participant.participantContact?.number || "Sem nome";
  };

  const getParticipantNumber = (participant) => {
    return participant.participantContact?.number || "";
  };

  const getParticipantAvatar = (participant) => {
    return participant.participantContact?.profilePicUrl || "";
  };

  if (loading) {
    return (
      <div className={classes.loadingContainer}>
        <CircularProgress size={24} />
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className={classes.emptyState}>
        <Typography variant="body2">
          Nenhum participante encontrado
        </Typography>
      </div>
    );
  }

  return (
    <List className={classes.root}>
      {participants.map((participant) => {
        const participantName = getParticipantName(participant);
        const participantNumber = getParticipantNumber(participant);
        const participantAvatar = getParticipantAvatar(participant);
        
        return (
          <ListItem key={participant.id} className={classes.participantItem}>
            <ListItemAvatar>
              <Avatar
                src={participantAvatar}
                alt={participantName}
                className={classes.avatar}
              >
                {getInitials(participantName)}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                <div style={{ display: "flex", alignItems: "center" }}>
                  <Typography className={classes.participantName}>
                    {participantName}
                  </Typography>
                  {participant.isSuperAdmin && (
                    <Chip
                      label="Super Admin"
                      size="small"
                      className={classes.superAdminChip}
                    />
                  )}
                  {!participant.isSuperAdmin && participant.isAdmin && (
                    <Chip
                      label="Admin"
                      size="small"
                      className={classes.adminChip}
                    />
                  )}
                </div>
              }
              secondary={
                participantNumber && (
                  <Typography className={classes.participantNumber}>
                    {participantNumber}
                  </Typography>
                )
              }
            />
          </ListItem>
        );
      })}
    </List>
  );
};

export default GroupParticipantsList;

