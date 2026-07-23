import React from "react";

import Paper from "@material-ui/core/Paper";

import SchedulesForm from "../SchedulesForm";

/**
 * Aba "Horários de Atendimento" do QueueModal: apenas o SchedulesForm dentro do
 * Paper. A lógica de salvar (setSchedules + voltar para a aba 0) fica no index.
 */
const QueueSchedulesTab = ({ schedules, onSubmit }) => {
  return (
    <Paper style={{ padding: 20 }}>
      <SchedulesForm
        loading={false}
        onSubmit={onSubmit}
        initialValues={schedules}
        labelSaveButton="Adicionar"
      />
    </Paper>
  );
};

export default QueueSchedulesTab;
