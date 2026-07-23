import { QueryInterface, DataTypes } from "sequelize";
interface ExistingColumns {
  [column: string]: unknown;
  };

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "Whatsapps";
    const column = "promptId";

    const tableInfo = (await queryInterface.describeTable(table)) as ExistingColumns;
    if (tableInfo[column]) {
      return Promise.resolve();
    }

    return queryInterface.addColumn(table, column, {
      type: DataTypes.INTEGER,
      references: { model: "Prompts", key: "id" },
      onUpdate: "RESTRICT",
      onDelete: "RESTRICT"
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Whatsapps", "promptId");
  }
};
