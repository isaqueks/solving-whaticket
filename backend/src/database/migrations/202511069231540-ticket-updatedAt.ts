import { QueryInterface, DataTypes } from "sequelize";
//
module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof import("sequelize").DataTypes & typeof import("sequelize").Sequelize) {
    await queryInterface.changeColumn('Tickets', 'updatedAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof import("sequelize").DataTypes & typeof import("sequelize").Sequelize) {
    await queryInterface.changeColumn('Tickets', 'updatedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  }
};