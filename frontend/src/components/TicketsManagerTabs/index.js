import React, { useContext, useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import SearchIcon from "@material-ui/icons/Search";
import InputBase from "@material-ui/core/InputBase";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Badge from "@material-ui/core/Badge";
import MoveToInboxIcon from "@material-ui/icons/MoveToInbox";
import CheckBoxIcon from "@material-ui/icons/CheckBox";

import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";

import NewTicketModal from "../NewTicketModal";
import TicketsList from "../TicketsListCustom";
import TabPanel from "../TabPanel";
import MessageSearchResults from "../MessageSearchResults";
import useMessageSearch from "../../hooks/useMessageSearch";
import { TicketsContext } from "../../context/Tickets/TicketsContext";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import TicketsQueueSelect from "../TicketsQueueSelect";
import { Button } from "@material-ui/core";
import { TagsFilter } from "../TagsFilter";
import { UsersFilter } from "../UsersFilter";

const useStyles = makeStyles(theme => ({
	ticketsWrapper: {
		position: "relative",
		display: "flex",
		height: "100%",
		flexDirection: "column",
		overflow: "hidden",
		borderTopRightRadius: 0,
		borderBottomRightRadius: 0,
		borderRadius:0,
	},

	tabsHeader: {
		flex: "none",
		backgroundColor: theme.palette.tabHeaderBackground,
	},

	tabsInternal: {
		flex: "none",
		backgroundColor: theme.palette.tabHeaderBackground
	},

	settingsIcon: {
		alignSelf: "center",
		marginLeft: "auto",
		padding: 8,
	},

	tab: {
		minWidth: 120,
		width: 120,
	},

	internalTab: {
		minWidth: 120,
		width: 120,
		padding: 5
	},

	ticketOptionsBox: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		background: theme.palette.optionsBackground,
		padding: theme.spacing(1),
	},

	ticketSearchLine: {
		padding: theme.spacing(1),
	},

	serachInputWrapper: {
		flex: 1,
		background: theme.palette.total,
		display: "flex",
		borderRadius: 40,
		padding: 4,
		marginRight: theme.spacing(1),
	},

	searchIcon: {
		color: "grey",
		marginLeft: 6,
		marginRight: 6,
		alignSelf: "center",
	},

	searchInput: {
		flex: 1,
		border: "none",
		borderRadius: 30,
	},

	insiderTabPanel: {
		height: '100%',
		marginTop: "-72px",
		paddingTop: "72px"
	},

	insiderDoubleTabPanel: {
		display:"flex",
		flexDirection: "column",
		marginTop: "-72px",
		paddingTop: "72px",
		height: "100%"
	},

	labelContainer: {
		width: "auto",
		padding: 0
	},
	iconLabelWrapper: {
		flexDirection: "row",
		'& > *:first-child': {
			marginBottom: '3px !important',
			marginRight: 16
		}
	},
	insiderTabLabel: {
		[theme.breakpoints.down(1600)]: {
			display:'none'
		}
	},
	badgeLabel: {
		paddingRight: theme.spacing(2),
	},
	searchResultsPanel: {
		display: "flex",
		flexDirection: "column",
		flex: 1,
		minHeight: 0,
	},
	smallFormControl: {
		'& .MuiOutlinedInput-input': {
			padding: "12px 10px",
		},
		'& .MuiInputLabel-outlined': {
			marginTop: "-6px"
		}
	}
}));

const TicketsManagerTabs = () => {
  const classes = useStyles();
  const history = useHistory();

  const [searchParam, setSearchParam] = useState("");
  const [tab, setTab] = useState("open");
  const [tabOpen, setTabOpen] = useState("read");
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  
  const searchInputRef = useRef();
  const searchTimeoutRef = useRef();
  const { user } = useContext(AuthContext);
  const { setCurrentTicket } = useContext(TicketsContext);
  const { profile } = user;

  // Base da lista, pelo perfil: admin vê todos os tickets; usuário vê os seus
  // e os pendentes. O antigo switch "Todos" (só admin) foi substituído pelo
  // "Só Minha Carteira", que refina essa base pelo responsável do contato.
  const showAllTickets = profile.toUpperCase() === "ADMIN";

  const [openCount, setOpenCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const userQueueIds = user.queues.map((q) => q.id);
  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  // "Só Minha Carteira": só tickets de contatos cujo responsável é o usuário logado
  const [myPortfolio, setMyPortfolio] = useState(() => {
    try {
      const saved = localStorage.getItem("myPortfolioTickets");
      return saved ? JSON.parse(saved) : false;
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem("myPortfolioTickets", JSON.stringify(myPortfolio));
  }, [myPortfolio]);

  // Chamado #95: a aba Busca procura conversas (nome/número do contato) e
  // também mensagens, em duas sub-abas
  const [searchTab, setSearchTab] = useState("tickets");
  const [ticketsSearchResult, setTicketsSearchResult] = useState({ searchParam: null, count: 0 });
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const autoSwitchedTermRef = useRef(null);

  const messageSearch = useMessageSearch({
    searchParam,
    enabled: tab === "search",
  });

  useEffect(() => {
    if (tab === "search") {
      searchInputRef.current.focus();
    }
  }, [tab]);

  useEffect(() => () => clearTimeout(searchTimeoutRef.current), []);

  // Nenhuma conversa corresponde ao termo mas há mensagens: vai sozinho para a
  // sub-aba Mensagens (uma vez por termo, para não brigar com a usuária)
  useEffect(() => {
    if (!searchParam || autoSwitchedTermRef.current === searchParam) return;
    if (
      ticketsSearchResult.searchParam === searchParam &&
      ticketsSearchResult.count === 0 &&
      messageSearch.loaded &&
      messageSearch.messages.length > 0
    ) {
      autoSwitchedTermRef.current = searchParam;
      setSearchTab("messages");
    }
  }, [searchParam, ticketsSearchResult, messageSearch.loaded, messageSearch.messages.length]);

  const handleSearch = (e) => {
    const searchedTerm = e.target.value.toLowerCase();

    clearTimeout(searchTimeoutRef.current);

    if (searchedTerm === "") {
      setSearchParam(searchedTerm);
      setTab("open");
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearchParam(searchedTerm);
    }, 500);
  };

  const handleSelectMessage = (message) => {
    const ticket = message.ticket;
    if (!ticket?.uuid) return;
    setSelectedMessageId(message.id);
    // objeto novo a cada clique: clicar de novo no mesmo resultado salta de novo
    setCurrentTicket({
      id: ticket.id ?? message.ticketId,
      uuid: ticket.uuid,
      focusMessageId: message.id,
    });
  };

  const messagesBadge =
    messageSearch.loaded && messageSearch.messages.length > 0
      ? messageSearch.hasMore
        ? `${messageSearch.messages.length}+`
        : messageSearch.messages.length
      : 0;

  const handleChangeTab = (e, newValue) => {
    setTab(newValue);
  };

  const handleChangeTabOpen = (e, newValue) => {
    setTabOpen(newValue);
  };

  const applyPanelStyle = (status) => {
    if (tabOpen !== status) {
      return { width: 0, height: 0 };
    }
  };

  const handleCloseOrOpenTicket = (ticket) => {
    setNewTicketModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const handleSelectedTags = (selecteds) => {
    const tags = selecteds.map((t) => t.id);
    setSelectedTags(tags);
  };

  const handleSelectedUsers = (selecteds) => {
    const users = selecteds.map((t) => t.id);
    setSelectedUsers(users);
  };

  return (
    <Paper elevation={0} variant="outlined" className={classes.ticketsWrapper}>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        onClose={(ticket) => {
          
          handleCloseOrOpenTicket(ticket);
        }}
      />
      <Paper elevation={0} square className={classes.tabsHeader}>
        <Tabs
          value={tab}
          onChange={handleChangeTab}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
          aria-label="icon label tabs example"
        >
          <Tab
            value={"open"}
            icon={<MoveToInboxIcon />}
            label={"Entrada"}
            classes={{ root: classes.tab }}
          />
          <Tab
            value={"closed"}
            icon={<CheckBoxIcon />}
            label={"Fechados"}
            classes={{ root: classes.tab }}
          />
          <Tab
            value={"search"}
            icon={<SearchIcon />}
            label={i18n.t("tickets.tabs.search.title")}
            classes={{ root: classes.tab }}
          />
        </Tabs>
      </Paper>
      <Paper square elevation={0} className={classes.ticketOptionsBox}>
        {tab === "search" ? (
          <div className={classes.serachInputWrapper}>
            <SearchIcon className={classes.searchIcon} />
            <InputBase
              className={classes.searchInput}
              inputRef={searchInputRef}
              placeholder={i18n.t("tickets.search.placeholder")}
              type="search"
              defaultValue={searchParam}
              onChange={handleSearch}
            />
          </div>
        ) : (
          <>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setNewTicketModalOpen(true)}
            >
              {i18n.t("ticketsManager.buttons.newTicket")}
            </Button>
            <FormControlLabel
              label={i18n.t("tickets.buttons.myPortfolio")}
              labelPlacement="start"
              control={
                <Switch
                  size="small"
                  checked={myPortfolio}
                  onChange={() => setMyPortfolio((prevState) => !prevState)}
                  name="myPortfolioTickets"
                  color="primary"
                />
              }
            />
          </>
        )}
        <TicketsQueueSelect
          style={{ marginLeft: 6 }}
          selectedQueueIds={selectedQueueIds}
          userQueues={user?.queues}
          onChange={(values) => setSelectedQueueIds(values)}
        />
      </Paper>
      <TabPanel value={tab} name="open" className={classes.ticketsWrapper}>
        <Tabs
          value={tabOpen}
          onChange={handleChangeTabOpen}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab
            label={
              <Badge
                className={classes.badge}
                badgeContent={openCount}
                color="primary"
              >
                Lidos
              </Badge>
            }
            value={"read"}
          />
          <Tab
            label={
              <Badge
                className={classes.badge}
                badgeContent={pendingCount}
                color="secondary"
              >
                Não lidos
              </Badge>
            }
            value={"unread"}
          />
        </Tabs>
        <Paper className={classes.ticketsWrapper}>
          <TicketsList
            // status="open"
            unread="read"
            showAll={showAllTickets}
            myPortfolio={myPortfolio}
            selectedQueueIds={selectedQueueIds}
            updateCount={(val) => setOpenCount(val)}
            style={applyPanelStyle("read")}
          />
          <TicketsList
            // status="pending"
            unread="unread"
            showAll={showAllTickets}
            myPortfolio={myPortfolio}
            selectedQueueIds={selectedQueueIds}
            updateCount={(val) => setPendingCount(val)}
            style={applyPanelStyle("unread")}
          />
        </Paper>
      </TabPanel>
      <TabPanel value={tab} name="closed" className={classes.ticketsWrapper}>
        <TicketsList
          status="closed"
          showAll={true}
          myPortfolio={myPortfolio}
          selectedQueueIds={selectedQueueIds}
        />
      </TabPanel>
      <TabPanel value={tab} name="search" className={classes.ticketsWrapper}>
        <Tabs
          value={searchTab}
          onChange={(e, newValue) => setSearchTab(newValue)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab
            label={i18n.t("messageSearch.tabs.tickets")}
            value={"tickets"}
          />
          <Tab
            label={
              <Badge badgeContent={messagesBadge} color="primary">
                {/* folga para o número não cobrir o fim do rótulo */}
                <span className={classes.badgeLabel}>
                  {i18n.t("messageSearch.tabs.messages")}
                </span>
              </Badge>
            }
            value={"messages"}
          />
        </Tabs>
        {/* filtros de tags/usuários só valem para conversas; escondidos (e não
            desmontados) para não perder o que já foi selecionado */}
        <div style={searchTab === "tickets" ? undefined : { display: "none" }}>
          <TagsFilter onFiltered={handleSelectedTags} />
          {profile === "admin" && (
            <UsersFilter onFiltered={handleSelectedUsers} />
          )}
        </div>
        <TicketsList
          searchParam={searchParam}
          showAll={true}
          myPortfolio={myPortfolio}
          tags={selectedTags}
          users={selectedUsers}
          selectedQueueIds={selectedQueueIds}
          onSearchLoaded={setTicketsSearchResult}
          style={searchTab === "tickets" ? undefined : { display: "none" }}
        />
        {searchTab === "messages" && (
          <div className={classes.searchResultsPanel}>
            <MessageSearchResults
              search={messageSearch}
              onSelect={handleSelectMessage}
              selectedId={selectedMessageId}
              showContact
            />
          </div>
        )}
      </TabPanel>
    </Paper>
  );
};

export default TicketsManagerTabs;
