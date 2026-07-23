/**
 * Descriptor das configurações da empresa (doc 03, fase F2 — Settings/Options).
 *
 * Substitui os 29 `useState` do componente por dados: cada campo declara sua
 * chave de persistência, tipo de controle, rótulo, opções e o layout (gridProps).
 * As chaves, valores e defaults são EXATAMENTE os do componente original.
 *
 * Rótulos/opções vêm do catálogo i18n (namespace `settings.options.*`, F3). As
 * arrays são avaliadas no load do módulo — depois do init síncrono do i18next
 * (resources inline), então `i18n.t` já resolve as chaves.
 *
 * Casos especiais tratados por config no item:
 *  - `toastOptions`: opções passadas ao toast de sucesso (ex.: scheduleType).
 *  - efeitos colaterais que dependem de props (ex.: scheduleTypeChanged) são
 *    injetados em runtime pelo componente via mapa por chave, não aqui.
 */

import { i18n } from "../../translate/i18n";

const enabledDisabled = (enabledLabel, disabledLabel) => [
  { value: "disabled", label: disabledLabel },
  { value: "enabled", label: enabledLabel },
];

const generalGrid = { xs: 12, sm: 6, md: 4 };

export const generalSettings = [
  {
    key: "userRating",
    type: "select",
    label: i18n.t("settings.options.userRating.label"),
    labelId: "ratings-label",
    defaultValue: "disabled",
    gridProps: generalGrid,
    options: enabledDisabled(
      i18n.t("settings.options.userRating.enabled"),
      i18n.t("settings.options.userRating.disabled")
    ),
  },
  {
    key: "scheduleType",
    type: "select",
    label: i18n.t("settings.options.scheduleType.label"),
    labelId: "schedule-type-label",
    defaultValue: "disabled",
    gridProps: generalGrid,
    options: [
      { value: "disabled", label: i18n.t("settings.options.scheduleType.disabled") },
      { value: "queue", label: i18n.t("settings.options.scheduleType.queue") },
      { value: "company", label: i18n.t("settings.options.scheduleType.company") },
    ],
    // toast customizado do componente original (posição/tempo próprios)
    toastOptions: {
      position: "top-right",
      autoClose: 2000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: false,
      draggable: true,
      theme: "light",
    },
  },
  {
    key: "CheckMsgIsGroup",
    type: "select",
    label: i18n.t("settings.options.checkMsgIsGroup.label"),
    labelId: "group-type-label",
    defaultValue: "enabled",
    gridProps: generalGrid,
    options: [
      { value: "disabled", label: i18n.t("settings.options.checkMsgIsGroup.disabled") },
      { value: "enabled", label: i18n.t("settings.options.checkMsgIsGroup.enabled") },
    ],
  },
  {
    key: "call",
    type: "select",
    label: i18n.t("settings.options.call.label"),
    labelId: "call-type-label",
    defaultValue: "enabled",
    gridProps: generalGrid,
    options: enabledDisabled(
      i18n.t("settings.options.call.accept"),
      i18n.t("settings.options.call.refuse")
    ),
  },
  {
    key: "chatBotType",
    type: "select",
    label: i18n.t("settings.options.chatBotType.label"),
    labelId: "chatbot-type-label",
    defaultValue: "",
    gridProps: generalGrid,
    options: [{ value: "text", label: i18n.t("settings.options.chatBotType.text") }],
  },
  {
    key: "sendGreetingAccepted",
    type: "select",
    label: i18n.t("settings.options.sendGreetingAccepted.label"),
    labelId: "sendGreetingAccepted-label",
    defaultValue: "disabled",
    gridProps: generalGrid,
    options: enabledDisabled(
      i18n.t("settings.options.enabled"),
      i18n.t("settings.options.disabled")
    ),
  },
  {
    key: "sendMsgTransfTicket",
    type: "select",
    label: i18n.t("settings.options.sendMsgTransfTicket.label"),
    labelId: "sendMsgTransfTicket-label",
    defaultValue: "disabled",
    gridProps: generalGrid,
    options: enabledDisabled(
      i18n.t("settings.options.enabled"),
      i18n.t("settings.options.disabled")
    ),
  },
  {
    key: "sendGreetingMessageOneQueues",
    type: "select",
    label: i18n.t("settings.options.sendGreetingMessageOneQueues.label"),
    labelId: "sendGreetingMessageOneQueues-label",
    defaultValue: "disabled",
    gridProps: generalGrid,
    options: enabledDisabled(
      i18n.t("settings.options.enabled"),
      i18n.t("settings.options.disabled")
    ),
  },
];

export const ixcSettings = [
  {
    key: "ipixc",
    type: "text",
    label: i18n.t("settings.options.ipixc.label"),
    defaultValue: "",
    gridProps: { xs: 12, sm: 6, md: 6 },
  },
  {
    key: "tokenixc",
    type: "text",
    label: i18n.t("settings.options.tokenixc.label"),
    defaultValue: "",
    gridProps: { xs: 12, sm: 6, md: 6 },
  },
];

export const mkauthSettings = [
  {
    key: "ipmkauth",
    type: "text",
    label: i18n.t("settings.options.ipmkauth.label"),
    defaultValue: "",
    gridProps: { xs: 12, sm: 12, md: 4 },
  },
  {
    key: "clientidmkauth",
    type: "text",
    label: i18n.t("settings.options.clientidmkauth.label"),
    defaultValue: "",
    gridProps: { xs: 12, sm: 12, md: 4 },
  },
  {
    key: "clientsecretmkauth",
    type: "text",
    label: i18n.t("settings.options.clientsecretmkauth.label"),
    defaultValue: "",
    gridProps: { xs: 12, sm: 12, md: 4 },
  },
];

export const asaasSettings = [
  {
    key: "asaas",
    type: "text",
    label: i18n.t("settings.options.asaas.label"),
    defaultValue: "",
    gridProps: { xs: 12, sm: 12, md: 12 },
  },
];

export const settingsSchema = [
  ...generalSettings,
  ...ixcSettings,
  ...mkauthSettings,
  ...asaasSettings,
];
