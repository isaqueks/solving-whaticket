/**
 * Exporta um CSV (Numero,Data) iterando sobre TODOS os tickets.
 *
 *   Numero -> número do contato do ticket
 *   Data   -> data da última mensagem do ticket (ISO 8601)
 *
 * Grupos são ignorados. Há uma linha por ticket (não há deduplicação por
 * número), conforme solicitado ("iterar sobre TODO ticket").
 *
 * Uso:
 *   npx ts-node src/scripts/exportLastContactCsv.ts [caminho-de-saida.csv]
 *
 * Sem argumento, grava em ./last-contact-export.csv (a partir do diretório
 * onde o comando for executado).
 */

import path from "path";
import fs from "fs";
import { fn, col, Op } from "sequelize";

import { appConfig } from "../config/AppConfig";
// Importar o database conecta o Sequelize, registra os models e carrega o .env
// (via ../bootstrap, importado por ../config/database).
import sequelize from "../database";
// Exceção justificada (B6): script administrativo standalone, executado FORA
// do runtime da aplicação (ts-node, somente leitura). O acesso direto aos
// models fica aceito aqui para não puxar a cadeia de services/repositories —
// os imports já apontam para os caminhos dos módulos donos.
import Ticket from "../modules/tickets/models/Ticket";
import Contact from "../modules/contacts/models/Contact";
import Message from "../modules/messages/models/Message";

const onlyDigits = (value: string): string => (value || "").replace(/\D/g, "");

async function run(): Promise<void> {
  // Escopo "database": o script só precisa das variáveis de banco — não exige
  // REDIS_URI/CHECK_AUTH_ENDPOINT como o boot do servidor.
  appConfig.validate("database");

  const outputArg = process.argv[2];
  const outputPath = path.resolve(
    process.cwd(),
    outputArg || "last-contact-export.csv"
  );

  console.log("[export] Conectando ao banco...");
  await sequelize.authenticate();

  // Tamanho do lote para paginação por keyset (id). Evita carregar todos os
  // tickets/mensagens de uma vez em memória e evita um GROUP BY de tabela
  // inteira em Messages.
  const BATCH_SIZE = 1000;

  // Grava em stream para não acumular todas as linhas em memória.
  const stream = fs.createWriteStream(outputPath, { encoding: "utf8" });
  const streamWrite = async (chunk: string): Promise<void> => {
    if (!stream.write(chunk)) {
      await new Promise<void>(resolve => stream.once("drain", resolve));
    }
  };

  await streamWrite("Numero,Data\n");

  let lastId = 0;
  let total = 0;
  let written = 0;
  let skippedNoNumber = 0;
  let skippedNoMessage = 0;

  // Paginação por keyset (id > lastId) processando um lote por vez.
  for (;;) {
    // Tickets individuais (não-grupo), com o contato carregado junto.
    const tickets = await Ticket.findAll({
      where: { isGroup: false, id: { [Op.gt]: lastId } },
      include: [
        {
          model: Contact,
          as: "contact",
          required: true,
          where: { isGroup: false },
          attributes: ["id", "number", "isGroup"]
        }
      ],
      attributes: ["id", "contactId", "isGroup", "updatedAt"],
      order: [["id", "ASC"]],
      limit: BATCH_SIZE
    });

    if (tickets.length === 0) {
      break;
    }

    lastId = tickets[tickets.length - 1].id;
    total += tickets.length;

    // Data da última mensagem por ticket: MAX(createdAt) agrupado por ticketId,
    // limitado aos tickets deste lote (evita N+1 e evita varrer toda a tabela).
    const ticketIds = tickets.map(ticket => ticket.id);
    const maxRows = (await Message.findAll({
      attributes: ["ticketId", [fn("MAX", col("createdAt")), "lastDate"]],
      where: { ticketId: { [Op.in]: ticketIds } },
      group: ["ticketId"],
      raw: true
    })) as unknown as { ticketId: number; lastDate: string }[];

    const lastDateByTicket = new Map<number, Date>();
    for (const row of maxRows) {
      if (row.ticketId != null && row.lastDate) {
        lastDateByTicket.set(Number(row.ticketId), new Date(row.lastDate));
      }
    }

    for (const ticket of tickets) {
      const numero = onlyDigits(ticket.contact?.number);
      if (!numero) {
        skippedNoNumber += 1;
        continue;
      }

      const lastDate = lastDateByTicket.get(ticket.id);
      if (!lastDate) {
        // Ticket sem mensagens: não há "última mensagem" para registrar.
        skippedNoMessage += 1;
        continue;
      }

      await streamWrite(`${numero},${lastDate.toISOString()}\n`);
      written += 1;
    }
  }

  await new Promise<void>((resolve, reject) => {
    stream.on("error", reject);
    stream.end(resolve);
  });

  console.log(`[export] ${total} tickets individuais encontrados.`);
  console.log(`[export] Linhas gravadas: ${written}`);
  console.log(`[export] Ignorados (sem número): ${skippedNoNumber}`);
  console.log(`[export] Ignorados (sem mensagem): ${skippedNoMessage}`);
  console.log(`[export] Arquivo gerado: ${outputPath}`);
}

run()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async err => {
    console.error("[export] Erro ao exportar:", err);
    try {
      await sequelize.close();
    } catch (_) {
      /* ignore */
    }
    process.exit(1);
  });
