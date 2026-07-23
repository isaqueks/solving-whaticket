import { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";
import { has, isArray } from "lodash";

import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { SocketContext } from "../../context/Socket/SocketContext";
import moment from "moment";
import Swal from 'sweetalert2';
import { SocketManager } from '../../context/Socket/SocketContext'
import { appConfig } from "../../config";

const useAuth = () => {
  const history = useHistory();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({});

  useEffect(() => {
    if (window['WINDOW_HASH']) {
      return;
    }

    window['WINDOW_HASH'] = (Date.now() + Math.random()*100).toFixed(5);
    const WINDOW_HASH = window['WINDOW_HASH'];
    
    localStorage.setItem('activeWindow', WINDOW_HASH);

    let handler = window.setInterval(() => {

      if (localStorage.getItem('activeWindow') !== WINDOW_HASH) {
        window.clearInterval(handler);
        Swal.fire({
          title: 'Você abriu o TalkChat em outra aba',
          text: 'Você só pode usar uma aba por vez',
          icon: "warning",
          confirmButtonText: 'Usar esta aba',
          allowOutsideClick: false,
        }).then(() => {
          window.location.reload();
        });

        SocketManager.manageds.forEach(m => {
          try {
            m.disconnect(false);
          }
          catch {}
        });
      }

    }, 2000);

    return () => window.clearInterval(handler);
  }, []);

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/auth/me");
        setIsAuth(true);
        setUser(data);
        setLoading(false);

        localStorage.setItem("companyId", data.companyId);
        localStorage.setItem("userId", data.id);
      }
      catch {
        setIsAuth(false);
        setLoading(false);
        return;
      }
    })();
  }, []);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    if (companyId) {
   
      const socket = socketManager.getSocket(companyId);

      socket.on(`company-${companyId}-user`, (data) => {
        if (data.action === "update" && data.user.id === user.id) {
          setUser(data.user);
        }
      });
    
    
    return () => {
      socket.disconnect();
    };
  }
  }, [socketManager, user]);

  const handleLogin = async (userData) => {
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", userData);
      const {
        user: { companyId, id, company },
      } = data;

      if (has(company, "settings") && isArray(company.settings)) {
        const setting = company.settings.find(
          (s) => s.key === "campaignsEnabled"
        );
        if (setting && setting.value === "true") {
          localStorage.setItem("cshow", null); //regra pra exibir campanhas
        }
      }

      moment.locale('pt-br');
      const dueDate = data.user.company.dueDate;
      const hoje = moment(moment()).format("DD/MM/yyyy");
      const vencimento = moment(dueDate).format("DD/MM/yyyy");

      var diff = moment(dueDate).diff(moment(moment()).format());

      var before = moment(moment().format()).isBefore(dueDate);
      var dias = moment.duration(diff).asDays();

      if (before === true) {
        localStorage.setItem("token", JSON.stringify(data.token));
        localStorage.setItem("companyId", companyId);
        localStorage.setItem("userId", id);
        localStorage.setItem("companyDueDate", vencimento);
        api.defaults.headers.Authorization = `Bearer ${data.token}`;
        setUser(data.user);
        setIsAuth(true);
        toast.success(i18n.t("auth.toasts.success"));
        if (Math.round(dias) < 5) {
          toast.warn(`Sua assinatura vence em ${Math.round(dias)} ${Math.round(dias) === 1 ? 'dia' : 'dias'} `);
        }

        let redirectPath = localStorage.getItem("redirectPath");
        if (redirectPath) {
          localStorage.removeItem("redirectPath");
        }
        else {
          redirectPath = "/tickets";
        }

        history.push(redirectPath);
        setLoading(false);
      } else {
        toastError(`Opss! Sua assinatura venceu ${vencimento}.
Entre em contato com o Suporte para mais informações! `);
        setLoading(false);
      }

      //quebra linha 
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);

    try {
      await api.delete("/auth/logout");
      setIsAuth(false);
      setUser({});
      localStorage.removeItem("token");
      localStorage.removeItem("companyId");
      localStorage.removeItem("userId");
      localStorage.removeItem("cshow");
      api.defaults.headers.Authorization = undefined;
      setLoading(false);
      window.location.href = `${appConfig.loginUrl}?redirect=${encodeURIComponent(window.location.href)}`;
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const getCurrentUserInfo = async () => {
    try {
      const { data } = await api.get("/auth/me");
      return data;
    } catch (err) {
      toastError(err);
    }
  };

  return {
    isAuth,
    user,
    loading,
    handleLogin,
    handleLogout,
    getCurrentUserInfo,
  };
};

export default useAuth;
