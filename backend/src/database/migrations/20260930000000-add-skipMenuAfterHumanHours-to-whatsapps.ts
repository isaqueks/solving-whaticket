import { QueryInterface, DataTypes } from "sequelize";
//
// Janela (em horas) em que uma mensagem humana nossa no ticket faz o cliente
// ir direto para a fila de transferência, sem receber o menu de filas.
// 0/null desativa. As conexões existentes passam a valer 24.
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Whatsapps", "skipMenuAfterHumanHours", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 24
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Whatsapps", "skipMenuAfterHumanHours");
  }
};
