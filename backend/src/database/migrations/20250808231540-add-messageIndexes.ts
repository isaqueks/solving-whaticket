import { QueryInterface, DataTypes } from "sequelize";
//
module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof import("sequelize").Sequelize) {
    // CREATE INDEX CONCURRENTLY só funciona via "sequelize.query" (não pelo addIndex)
    // porque o addIndex não expõe a flag "CONCURRENTLY"
    await queryInterface.sequelize.query(/*sql*/`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_company_ticket_created_id_desc
      ON "Messages" ("companyId", "ticketId", "createdAt" DESC, "id" DESC)
    `);
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof import("sequelize").Sequelize) {
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_company_ticket_created_id_desc
    `);
  }
};