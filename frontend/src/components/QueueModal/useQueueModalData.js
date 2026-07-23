import { useEffect, useState } from "react";

import { queuesApi } from "../../api/QueuesApi";
import { queueIntegrationsApi } from "../../api/QueueIntegrationsApi";
import { settingsApi } from "../../api/SettingsApi";
import toastError from "../../errors/toastError";

/**
 * Estado de carga do QueueModal (doc 03, fase F2).
 *
 * Concentra: leitura do setting `scheduleType` (habilita a aba de horários), a
 * lista de integrações, o carregamento da fila em edição (+ seus horários) e o
 * reset ao fechar. Toda I/O passa pelas classes de API — o componente nunca
 * conhece URL. Estados iniciais vieram tal-qual do index.js.
 */
export const queueModalInitialState = {
  name: "",
  color: "",
  greetingMessage: "",
  outOfHoursMessage: "",
  orderQueue: "",
  integrationId: ""
};

const defaultSchedules = [
  { weekday: "Segunda-feira", weekdayEn: "monday", startTime: "08:00", endTime: "18:00", },
  { weekday: "Terça-feira", weekdayEn: "tuesday", startTime: "08:00", endTime: "18:00", },
  { weekday: "Quarta-feira", weekdayEn: "wednesday", startTime: "08:00", endTime: "18:00", },
  { weekday: "Quinta-feira", weekdayEn: "thursday", startTime: "08:00", endTime: "18:00", },
  { weekday: "Sexta-feira", weekdayEn: "friday", startTime: "08:00", endTime: "18:00", },
  { weekday: "Sábado", weekdayEn: "saturday", startTime: "08:00", endTime: "12:00", },
  { weekday: "Domingo", weekdayEn: "sunday", startTime: "00:00", endTime: "00:00", },
];

const useQueueModalData = ({ queueId, open }) => {
  const [queue, setQueue] = useState(queueModalInitialState);
  const [schedulesEnabled, setSchedulesEnabled] = useState(false);
  const [integrations, setIntegrations] = useState([]);
  const [schedules, setSchedules] = useState(defaultSchedules);

  useEffect(() => {
    settingsApi.getAll().then(({ data }) => {
      if (Array.isArray(data)) {
        const scheduleType = data.find((d) => d.key === "scheduleType");
        if (scheduleType) {
          setSchedulesEnabled(scheduleType.value === "queue");
        }
      }
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await queueIntegrationsApi.list();

        setIntegrations(data.queueIntegrations);
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!queueId) return;
      try {
        const { data } = await queuesApi.show(queueId);
        setQueue((prevState) => {
          return { ...prevState, ...data };
        });

        setSchedules(data.schedules);
      } catch (err) {
        toastError(err);
      }
    })();

    return () => {
      setQueue({
        name: "",
        color: "",
        greetingMessage: "",
        outOfHoursMessage: "",
        orderQueue: "",
        integrationId: ""
      });
    };
  }, [queueId, open]);

  const resetQueue = () => setQueue(queueModalInitialState);

  return {
    queue,
    setQueue,
    schedules,
    setSchedules,
    schedulesEnabled,
    integrations,
    resetQueue,
  };
};

export default useQueueModalData;
