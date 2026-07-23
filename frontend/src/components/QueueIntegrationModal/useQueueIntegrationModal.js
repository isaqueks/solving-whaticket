import { useEffect, useState } from "react";

import { queueIntegrationsApi } from "../../api/QueueIntegrationsApi";
import toastError from "../../errors/toastError";

/**
 * Estado de carga do QueueIntegrationModal: mantém o objeto `integration`,
 * carrega a integração em edição (queueIntegrationsApi.show) e faz o reset ao
 * fechar. Toda I/O passa pela classe de API — o componente nunca conhece URL.
 * Estados iniciais (incluindo o reset "dialogflow" distinto do initialState)
 * vieram tal-qual do index.js.
 */
export const queueIntegrationInitialState = {
  type: "typebot",
  name: "",
  projectName: "",
  jsonContent: "",
  language: "",
  urlN8N: "",
  typebotDelayMessage: 1000,
  typebotExpires: 1,
  typebotKeywordFinish: "",
  typebotKeywordRestart: "",
  typebotRestartMessage: "",
  typebotSlug: "",
  typebotUnknownMessage: "",
};

const useQueueIntegrationModal = ({ integrationId, open }) => {
  const [integration, setIntegration] = useState(queueIntegrationInitialState);

  useEffect(() => {
    (async () => {
      if (!integrationId) return;
      try {
        const { data } = await queueIntegrationsApi.show(integrationId);
        setIntegration((prevState) => {
          return { ...prevState, ...data };
        });
      } catch (err) {
        toastError(err);
      }
    })();

    return () => {
      setIntegration({
        type: "dialogflow",
        name: "",
        projectName: "",
        jsonContent: "",
        language: "",
        urlN8N: "",
        typebotDelayMessage: 1000
      });
    };
  }, [integrationId, open]);

  const resetIntegration = () => setIntegration(queueIntegrationInitialState);

  return { integration, setIntegration, resetIntegration };
};

export default useQueueIntegrationModal;
