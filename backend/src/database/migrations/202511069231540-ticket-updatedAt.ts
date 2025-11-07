import { QueryInterface, DataTypes } from "sequelize";
//
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Tickets', 'updatedAt', {
      type: Sequelize.DATE,
      allowNull: true, // ou false se quiser manter obrigatório
    });
  },

  async down(queryInterface, Sequelize) {
    // Reverte para o comportamento automático do Sequelize
    await queryInterface.changeColumn('Tickets', 'updatedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      onUpdate: Sequelize.literal('CURRENT_TIMESTAMP'),
    });
  }
};