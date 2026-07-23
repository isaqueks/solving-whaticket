import { useEffect, useState } from "react";

import { toast } from "react-toastify";

import useSettings from "../../hooks/useSettings";
import { settingsSchema } from "./settingsSchema";

/**
 * Estado único das configurações da empresa (doc 03, fase F2).
 *
 * Substitui os 29 `useState` (14 valores + 14 loadings + variações) por um
 * único mapa `values` e um mapa `loadingKeys`, indexados pela chave da setting.
 * A gravação delega para `useSettings().update` (que passa pela SettingsApi).
 */
const buildDefaults = () =>
  settingsSchema.reduce((acc, { key, defaultValue }) => {
    acc[key] = defaultValue;
    return acc;
  }, {});

const useSettingsState = (settings) => {
  const { update } = useSettings();
  const [values, setValues] = useState(buildDefaults);
  const [loadingKeys, setLoadingKeys] = useState({});

  // Hidrata os valores a partir das settings carregadas — mantendo o
  // comportamento original: só sobrescreve a chave quando ela existe.
  useEffect(() => {
    if (Array.isArray(settings) && settings.length) {
      setValues((prev) => {
        const next = { ...prev };
        settingsSchema.forEach(({ key }) => {
          const found = settings.find((s) => s.key === key);
          if (found) {
            next[key] = found.value;
          }
        });
        return next;
      });
    }
  }, [settings]);

  const updateSetting = async (key, value, options = {}) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setLoadingKeys((prev) => ({ ...prev, [key]: true }));

    await update({ key, value });

    if (options.toastOptions) {
      toast.success("Operação atualizada com sucesso.", options.toastOptions);
    } else {
      toast.success("Operação atualizada com sucesso.");
    }

    setLoadingKeys((prev) => ({ ...prev, [key]: false }));

    if (typeof options.onChanged === "function") {
      options.onChanged(value);
    }
  };

  return { values, loadingKeys, updateSetting };
};

export default useSettingsState;
