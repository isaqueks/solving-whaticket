import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.removeConstraint(
        "Tickets",
        "contactid_companyid_unique"
      );
    } catch (err) {
      // Constraint may not exist yet; ignore so the migration is idempotent.
    }

    await queryInterface.addConstraint(
      "Tickets",
      ["contactId", "companyId", "whatsappId"],
      {
        type: "unique",
        name: "contactid_companyid_unique"
      }
    );
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeConstraint(
      "Tickets",
      "contactid_companyid_unique"
    );
  }
};
