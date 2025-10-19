import { QueryInterface, DataTypes } from "sequelize";
//
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([

      queryInterface.addColumn("Contacts", "lidNumber", {
        type: DataTypes.STRING(255),
        allowNull: true,
      }),

      queryInterface.addColumn("Contacts", "addressingMode", {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: 'pn',
      }),

    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Contacts", "lidNumber"),
      queryInterface.removeColumn("Contacts", "addressingMode"),
    ]);
  }
};