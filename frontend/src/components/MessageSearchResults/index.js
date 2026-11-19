import React from "react";
import { format, isToday, isYesterday, parseISO } from "date-fns";

import { alpha, makeStyles } from "@material-ui/core/styles";
import Avatar from "@material-ui/core/Avatar";
import CircularProgress from "@material-ui/core/CircularProgress";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import ListItemText from "@material-ui/core/ListItemText";
import Typography from "@material-ui/core/Typography";
import Skeleton from "@material-ui/lab/Skeleton";

import SearchIcon from "@material-ui/icons/Search";
import ImageIcon from "@material-ui/icons/Image";
import MicIcon from "@material-ui/icons/Mic";
import VideocamIcon from "@material-ui/icons/Videocam";
import InsertDriveFileIcon from "@material-ui/icons/InsertDriveFile";
import PersonIcon from "@material-ui/icons/Person";
import LocationOnIcon from "@material-ui/icons/LocationOn";

import { i18n } from "../../translate/i18n";
import { buildSnippet } from "./highlight";

const useStyles = makeStyles((theme) => ({
  root: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    backgroundColor: theme.palette.background.paper,
    ...theme.scrollbarStyles,
  },
  item: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  avatarWrapper: {
    minWidth: 56,
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  headerRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontWeight: 600,
  },
  date: {
    flex: "none",
    whiteSpace: "nowrap",
  },
  snippet: {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    wordBreak: "break-word",
    lineHeight: 1.45,
  },
  prefix: {
    color: theme.palette.text.primary,
    fontWeight: 500,
  },
  mediaIcon: {
    fontSize: 16,
    verticalAlign: "text-bottom",
    marginRight: 3,
    color: theme.palette.text.secondary,
  },
  highlight: {
    // marca-texto legível no claro e no escuro (o texto continua na cor do tema)
    backgroundColor: alpha(
      theme.palette.warning.main,
      theme.palette.type === "dark" ? 0.45 : 0.32
    ),
    color: theme.palette.text.primary,
    fontWeight: 600,
    borderRadius: 2,
    padding: "0 1px",
  },
  state: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    padding: theme.spacing(5, 3),
    color: theme.palette.text.secondary,
  },
  stateIcon: {
    fontSize: 40,
    marginBottom: theme.spacing(1),
    color: theme.palette.action.disabled,
  },
  loadingMore: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(2),
  },
}));

// mediaType gravados de fato; os demais são exibidos como texto
const MEDIA_ICONS = {
  image: ImageIcon,
  audio: MicIcon,
  video: VideocamIcon,
  application: InsertDriveFileIcon,
  contactMessage: PersonIcon,
  locationMessage: LocationOnIcon,
};

const MEDIA_LABELS = {
  image: "image",
  audio: "audio",
  video: "video",
  application: "document",
  contactMessage: "contact",
  locationMessage: "location",
};

const mediaLabel = (mediaType) =>
  MEDIA_LABELS[mediaType]
    ? i18n.t(`messageSearch.media.${MEDIA_LABELS[mediaType]}`)
    : "";

// Texto mostrado no resultado: em localização e contato o body guarda dados
// técnicos (URLs, vCard), então mostramos só a parte legível.
const displayText = (message) => {
  const body = message.body || "";
  if (message.mediaType === "locationMessage") {
    const parts = body.split("|");
    if (parts.length >= 2) return parts[2] || mediaLabel(message.mediaType);
  }
  if (message.mediaType === "contactMessage") {
    const fn = /FN:(.*)/.exec(body);
    if (fn) return fn[1].trim();
  }
  return body.trim() ? body : mediaLabel(message.mediaType);
};

// withTime: inclui a hora também em ontem/dias anteriores (painel da conversa,
// onde vários resultados costumam ser do mesmo dia)
const formatResultDate = (value, withTime) => {
  if (!value) return "";
  const date = typeof value === "string" ? parseISO(value) : new Date(value);
  if (isNaN(date)) return "";
  const time = format(date, "HH:mm");
  if (isToday(date)) return time;
  const day = isYesterday(date)
    ? i18n.t("messageSearch.yesterday")
    : format(date, "dd/MM/yyyy");
  return withTime ? `${day} ${time}` : day;
};

const ResultItem = ({ message, term, showContact, isGroup, selected, onSelect }) => {
  const classes = useStyles();
  const contact = message.ticket?.contact || {};
  const group = message.ticket?.isGroup ?? isGroup;

  let prefix = "";
  if (message.fromMe) {
    prefix = `${i18n.t("messageSearch.you")}: `;
  } else if (group && message.contact?.name) {
    prefix = `${message.contact.name}: `;
  }

  const MediaIcon = MEDIA_ICONS[message.mediaType];
  const { parts, leading, trailing } = buildSnippet(displayText(message), term);

  return (
    <ListItem
      button
      divider
      alignItems="flex-start"
      selected={selected}
      onClick={() => onSelect(message)}
      className={classes.item}
    >
      {showContact && (
        <ListItemAvatar className={classes.avatarWrapper}>
          <Avatar src={contact.profilePicUrl || undefined} className={classes.avatar} />
        </ListItemAvatar>
      )}
      <ListItemText
        disableTypography
        primary={
          <div className={classes.headerRow}>
            {showContact && (
              <Typography
                noWrap
                component="span"
                variant="body2"
                color="textPrimary"
                className={classes.name}
              >
                {contact.name || contact.number || message.contact?.name}
              </Typography>
            )}
            <Typography variant="caption" color="textSecondary" className={classes.date}>
              {formatResultDate(message.createdAt, !showContact)}
            </Typography>
          </div>
        }
        secondary={
          <Typography
            component="div"
            variant="body2"
            color="textSecondary"
            className={classes.snippet}
          >
            {prefix && <span className={classes.prefix}>{prefix}</span>}
            {MediaIcon && <MediaIcon className={classes.mediaIcon} />}
            {leading && "…"}
            {parts.map((part, index) =>
              part.match ? (
                <mark key={index} className={classes.highlight}>
                  {part.text}
                </mark>
              ) : (
                <React.Fragment key={index}>{part.text}</React.Fragment>
              )
            )}
            {trailing && "…"}
          </Typography>
        }
      />
    </ListItem>
  );
};

const ResultsSkeleton = ({ showContact }) => (
  <>
    {[0, 1, 2, 3].map((i) => (
      <ListItem key={i} divider alignItems="flex-start">
        {showContact && (
          <ListItemAvatar style={{ minWidth: 56 }}>
            <Skeleton
              animation="wave"
              variant="rect"
              width={44}
              height={44}
              style={{ borderRadius: 8 }}
            />
          </ListItemAvatar>
        )}
        <ListItemText
          disableTypography
          primary={<Skeleton animation="wave" height={20} width="45%" />}
          secondary={
            <>
              <Skeleton animation="wave" height={18} />
              <Skeleton animation="wave" height={18} width="70%" />
            </>
          }
        />
      </ListItem>
    ))}
  </>
);

/**
 * Lista de resultados da busca de mensagens (chamado #95). Recebe o retorno de
 * useMessageSearch em `search`.
 * - showContact: mostra avatar e nome da conversa (busca global)
 * - isGroup: a conversa é um grupo (busca dentro da conversa)
 */
const MessageSearchResults = ({
  search,
  onSelect,
  selectedId,
  showContact = false,
  isGroup = false,
  hint,
}) => {
  const classes = useStyles();
  const { term, messages, hasMore, loading, error, loaded, tooShort, loadMore } = search;

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + clientHeight) < 150) {
      loadMore();
    }
  };

  const renderState = (text) => (
    <div className={classes.state}>
      <SearchIcon className={classes.stateIcon} />
      <Typography variant="body2" color="inherit">
        {text}
      </Typography>
    </div>
  );

  let stateContent = null;
  let listContent = null;
  if (!term) {
    stateContent = renderState(hint || i18n.t("messageSearch.hint"));
  } else if (tooShort) {
    stateContent = renderState(i18n.t("messageSearch.tooShort"));
  } else if (!loaded) {
    listContent = <ResultsSkeleton showContact={showContact} />;
  } else if (error) {
    stateContent = renderState(i18n.t("messageSearch.error"));
  } else if (messages.length === 0) {
    stateContent = renderState(
      i18n.t("messageSearch.noResults", {
        term,
        interpolation: { escapeValue: false },
      })
    );
  } else {
    listContent = (
      <>
        {messages.map((message) => (
          <ResultItem
            key={message.id}
            message={message}
            term={term}
            showContact={showContact}
            isGroup={isGroup}
            selected={selectedId === message.id}
            onSelect={onSelect}
          />
        ))}
      </>
    );
  }

  return (
    <div className={classes.root} onScroll={handleScroll}>
      {listContent ? <List disablePadding>{listContent}</List> : stateContent}
      {listContent && loaded && loading && (
        <div className={classes.loadingMore}>
          <CircularProgress size={24} />
        </div>
      )}
    </div>
  );
};

export default MessageSearchResults;
