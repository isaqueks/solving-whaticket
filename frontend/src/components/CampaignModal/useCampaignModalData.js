import { useEffect, useRef, useState } from "react";

import moment from "moment";

import { campaignsApi } from "../../api/CampaignsApi";
import { contactListsApi } from "../../api/ContactListsApi";
import { filesApi } from "../../api/FilesApi";
import { tagsApi } from "../../api/TagsApi";
import { whatsAppsApi } from "../../api/WhatsAppsApi";
import toastError from "../../errors/toastError";

/**
 * Estado de carga/edição do CampaignModal (doc 03, fase F2).
 *
 * Concentra o fetch das listas auxiliares (arquivos, listas de contato,
 * conexões, tags), o carregamento da campanha em edição e o cálculo de
 * `campaignEditable`. Toda I/O passa pelas classes de API — o componente
 * nunca conhece URL.
 */
const buildInitialState = (companyId) => ({
  name: "",
  message1: "",
  message2: "",
  message3: "",
  message4: "",
  message5: "",
  confirmationMessage1: "",
  confirmationMessage2: "",
  confirmationMessage3: "",
  confirmationMessage4: "",
  confirmationMessage5: "",
  status: "INATIVA", // INATIVA, PROGRAMADA, EM_ANDAMENTO, CANCELADA, FINALIZADA,
  confirmation: false,
  scheduledAt: "",
  whatsappId: "",
  contactListId: "",
  tagListId: "Nenhuma",
  companyId,
});

const useCampaignModalData = ({ campaignId, open, initialValues, companyId }) => {
  const isMounted = useRef(true);
  const initialState = buildInitialState(companyId);

  const [campaign, setCampaign] = useState(initialState);
  const [whatsapps, setWhatsapps] = useState([]);
  const [contactLists, setContactLists] = useState([]);
  const [tagLists, setTagLists] = useState([]);
  const [files, setFiles] = useState(null);
  const [campaignEditable, setCampaignEditable] = useState(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await filesApi.list({ companyId });
        setFiles(data.files);
      } catch (err) {
        toastError(err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isMounted.current) {
      if (initialValues) {
        setCampaign((prevState) => {
          return { ...prevState, ...initialValues };
        });
      }

      contactListsApi
        .list({ companyId })
        .then(({ data }) => setContactLists(data));

      whatsAppsApi.list().then(({ data }) => setWhatsapps(data));

      tagsApi
        .list({ companyId })
        .then(({ data }) => {
          const fetchedTags = data.tags;
          // Perform any necessary data transformation here
          const formattedTagLists = fetchedTags.map((tag) => ({
            id: tag.id,
            name: tag.name,
          }));
          setTagLists(formattedTagLists);
        })
        .catch((error) => {
          toastError(error);
        });

      if (!campaignId) return;

      campaignsApi.show(campaignId).then(({ data }) => {
        setCampaign((prev) => {
          let prevCampaignData = Object.assign({}, prev);

          Object.entries(data).forEach(([key, value]) => {
            if (key === "scheduledAt" && value !== "" && value !== null) {
              prevCampaignData[key] = moment(value).format("YYYY-MM-DDTHH:mm");
            } else {
              prevCampaignData[key] = value === null ? "" : value;
            }
          });

          return prevCampaignData;
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, open, initialValues, companyId]);

  useEffect(() => {
    const now = moment();
    const scheduledAt = moment(campaign.scheduledAt);
    const moreThenAnHour =
      !Number.isNaN(scheduledAt.diff(now)) && scheduledAt.diff(now, "hour") > 1;
    const isEditable =
      campaign.status === "INATIVA" ||
      (campaign.status === "PROGRAMADA" && moreThenAnHour);

    setCampaignEditable(isEditable);
  }, [campaign.status, campaign.scheduledAt]);

  const resetCampaign = () => setCampaign(initialState);

  return {
    campaign,
    setCampaign,
    whatsapps,
    contactLists,
    tagLists,
    files,
    campaignEditable,
    resetCampaign,
  };
};

export default useCampaignModalData;
