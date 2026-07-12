import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addIndex(
      "Tickets",
      ["companyId", "status", "updatedAt"],
      {
        name: "idx_tk_company_id_status_updated_at"
      }
    );

    await queryInterface.addIndex("TicketTraking", ["ticketId"], {
      name: "idx_tktrk_ticket_id"
    });

    await queryInterface.addIndex("Schedules", ["status", "sendAt"], {
      name: "idx_sched_status_send_at"
    });

    // Redundant: strict prefix of idx_company_ticket_created_id_desc
    // (companyId, ticketId, createdAt DESC, id DESC), so it serves no read.
    await queryInterface.removeIndex("Messages", "idx_ms_company_id_ticket_id");
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.addIndex("Messages", ["companyId", "ticketId"], {
      name: "idx_ms_company_id_ticket_id"
    });

    await queryInterface.removeIndex("Schedules", "idx_sched_status_send_at");

    await queryInterface.removeIndex("TicketTraking", "idx_tktrk_ticket_id");

    await queryInterface.removeIndex(
      "Tickets",
      "idx_tk_company_id_status_updated_at"
    );
  }
};
