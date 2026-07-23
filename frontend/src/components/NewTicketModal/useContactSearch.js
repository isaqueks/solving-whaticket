import { useEffect, useState } from "react";

import { contactsApi } from "../../api/ContactsApi";
import toastError from "../../errors/toastError";

/**
 * Busca de contatos do NewTicketModal: semeia a lista a partir do
 * `initialContact` (quando vem preenchido) e faz a busca com debounce (≥ 3
 * caracteres, só com o modal aberto) via ContactsApi. `loading` também cobre o
 * spinner inicial do modal, por isso `setLoading` é exposto ao componente.
 */
export const useContactSearch = ({ modalOpen, initialContact, onSelectInitial }) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");

  useEffect(() => {
    if (initialContact?.id !== undefined) {
      setOptions([initialContact]);
      onSelectInitial(initialContact);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContact]);

  useEffect(() => {
    if (!modalOpen || searchParam.length < 3) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await contactsApi.list({ searchParam });
          setOptions(data.contacts);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, modalOpen]);

  return { options, loading, setLoading, searchParam, setSearchParam };
};
