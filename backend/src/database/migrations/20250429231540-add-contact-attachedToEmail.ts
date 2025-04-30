import { QueryInterface, DataTypes } from "sequelize";
//
module.exports = {

  up: (queryInterface: QueryInterface) => {
    return Promise.all([

      queryInterface.addColumn("Contacts", "attachedToEmail", {
        type: DataTypes.STRING(255),
        allowNull: true,
      }),

    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Contacts", "attachedToEmail"),
    ]);
  }

};
