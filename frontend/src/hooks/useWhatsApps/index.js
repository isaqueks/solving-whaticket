import { useState, useEffect, useReducer } from "react";
import toastError from "../../errors/toastError";

import { whatsAppsApi } from "../../api/WhatsAppsApi";
import { createEntityReducer } from "../../store/createEntityReducer";
import { SocketEvents } from "../../services/socketEvents";
import useSocketEvent from "../useSocketEvent";

const reducer = createEntityReducer({
  load: "LOAD_WHATSAPPS",
  update: "UPDATE_WHATSAPPS",
  remove: "DELETE_WHATSAPPS",
  loadStrategy: "replace",
  extra: {
    UPDATE_SESSION: (state, action) => {
      const whatsApp = action.payload;
      const index = state.findIndex((s) => s.id === whatsApp.id);

      if (index === -1) {
        return [...state];
      }

      const next = [...state];
      next[index] = {
        ...next[index],
        status: whatsApp.status,
        updatedAt: whatsApp.updatedAt,
        qrcode: whatsApp.qrcode,
        retries: whatsApp.retries,
      };
      return next;
    },
  },
});

const useWhatsApps = () => {
  const [whatsApps, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(true);

  const companyId = localStorage.getItem("companyId");

  useEffect(() => {
    setLoading(true);
    const fetchSession = async () => {
      try {
        const { data } = await whatsAppsApi.list();
        dispatch({ type: "LOAD_WHATSAPPS", payload: data });
        setLoading(false);
      } catch (err) {
        setLoading(false);
        toastError(err);
      }
    };
    fetchSession();
  }, []);

  useSocketEvent(SocketEvents.companyWhatsapp(companyId), (data) => {
    if (data.action === "update") {
      dispatch({ type: "UPDATE_WHATSAPPS", payload: data.whatsapp });
    }

    if (data.action === "delete") {
      dispatch({ type: "DELETE_WHATSAPPS", payload: data.whatsappId });
    }
  });

  useSocketEvent(SocketEvents.companyWhatsappSession(companyId), (data) => {
    if (data.action === "update") {
      dispatch({ type: "UPDATE_SESSION", payload: data.session });
    }
  });

  return { whatsApps, loading };
};

export default useWhatsApps;
