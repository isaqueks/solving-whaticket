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
import { fn, col } from "sequelize";

// Importar o database conecta o Sequelize, registra os models e carrega o .env
// (via ../bootstrap, importado por ../config/database).
import sequelize from "../database";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import Message from "../models/Message";

const onlyDigits = (value: string): string => (value || "").replace(/\D/g, "");

async function run(): Promise<void> {
  const outputArg = process.argv[2];
  const outputPath = path.resolve(
    process.cwd(),
    outputArg || "last-contact-export.csv"
  );

  console.log("[export] Conectando ao banco...");
  await sequelize.authenticate();

  // Tickets individuais (não-grupo), com o contato carregado junto.
  const tickets = await Ticket.findAll({
    where: { isGroup: false },
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
    order: [["id", "ASC"]]
  });

  console.log(`[export] ${tickets.length} tickets individuais encontrados.`);

  // Data da última mensagem por ticket: MAX(createdAt) agrupado por ticketId,
  // em uma única consulta (evita N+1).
  const maxRows = (await Message.findAll({
    attributes: ["ticketId", [fn("MAX", col("createdAt")), "lastDate"]],
    group: ["ticketId"],
    raw: true
  })) as unknown as { ticketId: number; lastDate: string }[];

  const lastDateByTicket = new Map<number, Date>();
  for (const row of maxRows) {
    if (row.ticketId != null && row.lastDate) {
      lastDateByTicket.set(Number(row.ticketId), new Date(row.lastDate));
    }
  }

  const lines: string[] = ["Numero,Data"];
  let written = 0;
  let skippedNoNumber = 0;
  let skippedNoMessage = 0;

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

    lines.push(`${numero},${lastDate.toISOString()}`);
    written += 1;
  }

  fs.writeFileSync(outputPath, lines.join("\n") + "\n", "utf8");

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
