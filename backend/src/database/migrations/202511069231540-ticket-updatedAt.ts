import { QueryInterface, DataTypes } from "sequelize";
//
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Tickets', 'updatedAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Tickets', 'updatedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  }
};