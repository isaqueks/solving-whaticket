import React, { useContext, useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import api from "../../services/api";
import Ticket from "../../components/Ticket";
import { makeStyles } from "@material-ui/core";


const useStyles = makeStyles(theme => ({
	centerAll: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
}));

export function Embed(props) {
  const { phoneNumber } = useParams();
  const [ ticket, setTicket ] = useState(null);
  const [ error, setError ] = useState(null);
  const classes = useStyles();

  useEffect(() => {

    api.get(`/ticket-by-number?phone=${encodeURIComponent(phoneNumber)}`)
    .then(res => {
      setTicket(res.data);
    })
    .catch(err => {
      console.error(err);
      setError(err);
    });

  }, [phoneNumber]);

  return (<>
    {(ticket) ? (
        <Ticket ticketId={ticket.uuid} small={true} />
    ) : error ? <>
        Não foi possível carregar o ticket. <br />
        <a onClick={e => window.location.reload()}>Recarregar página</a>
      </> : (
      <p>Carregando...</p>
    )}
  </>);
  
}