import { useEffect, useState } from "react";

import { queueOptionsApi } from "../../api/QueueOptionsApi";
import toastError from "../../errors/toastError";

/**
 * Estado das opções de topo (parentId = -1) do chatbot da fila: carrega a lista
 * inicial via QueueOptionsApi, expõe `updateOptions` (force re-render após
 * mutações no lugar, como no original) e `addOption` (novo nó raiz). Os nós
 * filhos são carregados sob demanda dentro do QueueOptionNode.
 */
export const useQueueOptions = (queueId) => {
  const [options, setOptions] = useState([]);

  useEffect(() => {
    if (queueId) {
      const fetchOptions = async () => {
        try {
          const { data } = await queueOptionsApi.list({ queueId, parentId: -1 });
          const optionList = data.map((option) => {
            return {
              ...option,
              children: [],
              edition: false,
            };
          });
          setOptions(optionList);
        } catch (e) {
          toastError(e);
        }
      };
      fetchOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateOptions = () => {
    setOptions([...options]);
  };

  const addOption = () => {
    const newOption = {
      title: "",
      message: "",
      edition: false,
      option: options.length + 1,
      queueId,
      parentId: null,
      children: [],
    };
    setOptions([...options, newOption]);
  };

  return { options, updateOptions, addOption };
};
