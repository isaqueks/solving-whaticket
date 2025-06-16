import React, { useContext, useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import api from "../../services/api";
import Ticket from "../../components/Ticket";


export function Embed(props) {
  const { phoneNumber } = useParams();
  const [ ticket, setTicket ] = useState(null);


  useEffect(() => {

    api.get(`/ticket-by-number?phone=${encodeURIComponent(phoneNumber)}`)
    .then(res => {
      setTicket(res.data);
    })
    .catch(err => {
      console.error(err);
    });

  }, [phoneNumber]);

  return (<>
    {ticket ? (
      <div>
        <Ticket ticketId={ticket.uuid} />
      </div>
    ) : (
      <p>Carregando...</p>
    )}
  </>);
  
}