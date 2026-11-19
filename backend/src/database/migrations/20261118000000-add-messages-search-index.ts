import { QueryInterface } from "sequelize";

// Busca de mensagens por palavra-chave (chamado #95): índice GIN de trigramas
// sobre o corpo sem acento e em minúsculas, para que
// f_unaccent_lower(body) LIKE f_unaccent_lower('%termo%') não faça seq scan.
//
// Cada comando vai num query() separado: o CREATE INDEX CONCURRENTLY não pode
// rodar dentro de transação, nem de uma string com vários comandos (o Postgres
// executa uma string multi-comando como um bloco de transação implícito).
// O sequelize-cli 5 não embrulha a migration em transação.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "CREATE EXTENSION IF NOT EXISTS pg_trgm"
    );
    await queryInterface.sequelize.query(
      "CREATE EXTENSION IF NOT EXISTS unaccent"
    );

    // unaccent() é só STABLE; o índice de expressão exige função IMMUTABLE.
    // Fixar o dicionário e o schema torna o resultado determinístico.
    await queryInterface.sequelize.query(/* sql */ `
      CREATE OR REPLACE FUNCTION f_unaccent_lower(text)
      RETURNS text
      LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
      AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, $1)) $$
    `);

    // CONCURRENTLY para não travar a gravação de mensagens enquanto cria.
    // Se ele for interrompido (erro, deploy cancelado), sobra um índice
    // INVALID com esse nome e o IF NOT EXISTS pularia a criação; por isso o
    // índice inválido é derrubado antes. Manualmente:
    //   DROP INDEX idx_messages_body_search;  -- e rodar a migration de novo
    await queryInterface.sequelize.query(/* sql */ `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_index i
          JOIN pg_class c ON c.oid = i.indexrelid
          WHERE c.relname = 'idx_messages_body_search' AND NOT i.indisvalid
        ) THEN
          DROP INDEX idx_messages_body_search;
        END IF;
      END $$
    `);
    await queryInterface.sequelize.query(/* sql */ `
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_body_search
      ON "Messages" USING gin (f_unaccent_lower(body) gin_trgm_ops)
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "DROP INDEX CONCURRENTLY IF EXISTS idx_messages_body_search"
    );
    await queryInterface.sequelize.query(
      "DROP FUNCTION IF EXISTS f_unaccent_lower(text)"
    );
  }
};
