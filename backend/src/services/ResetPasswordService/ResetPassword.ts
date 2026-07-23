import sequelize from "sequelize";
import database from "../../database";
import { hash } from "bcryptjs";
import { logger } from "../../utils/logger";
const ResetPassword = async (
  email: string,
  token: string,
  password: string
) => {
  const { hasResult, data } = await filterUser(email, token);
  if (!hasResult) {
    return { status: 404, message: "Email não encontrado" };
  }
  if (hasResult === true) {
    try {
      const convertPassword: string = await hash(password, 8);
      const { hasResults, datas } = await insertHasPassword(
        email,
        token,
        convertPassword
      );
      if (datas.length === 0) {
        return { status: 404, message: "Token não encontrado" };
      }
    } catch (err) {
      logger.error(err);
    }
  }
};
export default ResetPassword;
const filterUser = async (email: string, token: string) => {
  const sql = `SELECT * FROM "Users"  WHERE email = :email AND "resetPassword" != ''`;
  const result = await database.query(sql, {
    replacements: { email },
    type: sequelize.QueryTypes.SELECT
  });
  return { hasResult: result.length > 0, data: result };
};
const insertHasPassword = async (
  email: string,
  token: string,
  convertPassword: string
) => {
  const sqlValida = `SELECT * FROM "Users"  WHERE email = :email AND "resetPassword" = :token`;
  const resultado = await database.query(sqlValida, {
    replacements: { email, token },
    type: sequelize.QueryTypes.SELECT
  });
  const sqls = `UPDATE  "Users"  SET "passwordHash"= :convertPassword , "resetPassword" = '' WHERE email= :email AND "resetPassword" = :token`;
  const results = await database.query(sqls, {
    replacements: { email, token, convertPassword },
    type: sequelize.QueryTypes.UPDATE
  });
  return { hasResults: results.length > 0, datas: resultado };
};
