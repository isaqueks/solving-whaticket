import React, { useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";

import { makeStyles } from "@material-ui/core/styles";
import Drawer from "@material-ui/core/Drawer";
import IconButton from "@material-ui/core/IconButton";
import InputBase from "@material-ui/core/InputBase";
import Typography from "@material-ui/core/Typography";
import CloseIcon from "@material-ui/icons/Close";
import SearchIcon from "@material-ui/icons/Search";

import { i18n } from "../../translate/i18n";
import useMessageSearch from "../../hooks/useMessageSearch";
import MessageSearchResults from "../MessageSearchResults";

const drawerWidth = 320;

// Mesmo padrão visual do ContactDrawer (largura, borda, cabeçalho com fechar).
const useStyles = makeStyles((theme) => ({
  drawer: {
    // o espaço do painel já é reservado pelo ContactDrawer (só um fica aberto
    // por vez), então este não ocupa largura no layout
    width: 0,
    flexShrink: 0,
  },
  drawerPaper: {
    width: drawerWidth,
    display: "flex",
    flexDirection: "column",
    borderTop: `1px solid ${theme.palette.divider}`,
    borderRight: `1px solid ${theme.palette.divider}`,
    borderBottom: `1px solid ${theme.palette.divider}`,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  header: {
    display: "flex",
    flex: "none",
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.contactdrawer,
    alignItems: "center",
    padding: theme.spacing(0, 1),
    minHeight: "73px",
    justifyContent: "flex-start",
  },
  searchBox: {
    flex: "none",
    padding: theme.spacing(1),
    backgroundColor: theme.palette.optionsBackground,
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  searchInputWrapper: {
    display: "flex",
    alignItems: "center",
    background: theme.palette.total,
    borderRadius: 40,
    padding: 4,
  },
  searchIcon: {
    color: theme.palette.text.secondary,
    marginLeft: 6,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
  },
}));

const MessageSearchDrawer = ({ open, onClose, ticket, onSelectMessage }) => {
  const classes = useStyles();
  const inputRef = useRef();
  const [input, setInput] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [debouncedInput] = useDebounce(input, 400);
  const ticketId = ticket?.id;

  const search = useMessageSearch({
    // apagar o campo limpa os resultados na hora, sem esperar o debounce
    searchParam: input.trim() ? debouncedInput : "",
    ticketId,
    enabled: open && !!ticketId,
  });

  // ao fechar ou trocar de conversa, começa do zero. Ao abrir, foca o campo
  // já (e não no fim da animação), senão o que se digita nesse intervalo vai
  // para a caixa de mensagem; preventScroll porque o painel ainda está fora
  // da área visível e o navegador rolaria o contêiner da conversa.
  useEffect(() => {
    setInput("");
    setSelectedId(null);
    if (open && inputRef.current) inputRef.current.focus({ preventScroll: true });
  }, [open, ticketId]);

  const handleSelect = (message) => {
    setSelectedId(message.id);
    onSelectMessage(message);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <Drawer
      className={classes.drawer}
      variant="persistent"
      anchor="right"
      open={open}
      PaperProps={{ style: { position: "absolute" }, onKeyDown: handleKeyDown }}
      classes={{ paper: classes.drawerPaper }}
    >
      <div className={classes.header}>
        <IconButton onClick={onClose} aria-label={i18n.t("messageSearch.drawer.close")}>
          <CloseIcon />
        </IconButton>
        <Typography>{i18n.t("messageSearch.drawer.title")}</Typography>
      </div>
      <div className={classes.searchBox}>
        <div className={classes.searchInputWrapper}>
          <SearchIcon className={classes.searchIcon} />
          <InputBase
            className={classes.searchInput}
            inputRef={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={i18n.t("messageSearch.drawer.placeholder")}
            type="search"
            inputProps={{ "aria-label": i18n.t("messageSearch.drawer.title") }}
          />
        </div>
      </div>
      <MessageSearchResults
        search={search}
        onSelect={handleSelect}
        selectedId={selectedId}
        isGroup={!!ticket?.isGroup}
        hint={i18n.t("messageSearch.hintTicket")}
      />
    </Drawer>
  );
};

export default MessageSearchDrawer;
