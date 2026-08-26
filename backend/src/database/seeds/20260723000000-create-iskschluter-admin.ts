import { QueryInterface } from "sequelize";
import { hash } from "bcryptjs";

// Usuário admin de teste solicitado: iskschluter@gmail.com / senha "123456".
// Idempotente: só insere se ainda não existir.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM "Users" WHERE email = 'iskschluter@gmail.com' LIMIT 1`
    );

    if ((existing as unknown[]).length > 0) {
      return;
    }

    const passwordHash = await hash("123456", 8);
    await queryInterface.bulkInsert("Users", [
      {
        name: "Isaque",
        email: "iskschluter@gmail.com",
        profile: "admin",
        passwordHash,
        companyId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        super: true
      }
    ]);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.bulkDelete("Users", {
      email: "iskschluter@gmail.com"
    });
  }
};
