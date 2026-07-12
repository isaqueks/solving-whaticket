import { head } from "lodash";
import XLSX from "xlsx";
import { has } from "lodash";
import Contact from "../../models/Contact";
import CheckContactNumber from "../WbotServices/CheckNumber";
import { logger } from "../../utils/logger";

export async function ImportContacts(
  companyId: number,
  file: Express.Multer.File | undefined
) {
  const workbook = XLSX.readFile(file?.path as string);
  const worksheet = head(Object.values(workbook.Sheets)) as any;
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 0 });
  const contacts = rows.map(row => {
    let name = "";
    let number = "";
    let email = "";

    if (has(row, "nome") || has(row, "Nome")) {
      name = row["nome"] || row["Nome"];
    }

    if (
      has(row, "numero") ||
      has(row, "número") ||
      has(row, "Numero") ||
      has(row, "Número")
    ) {
      number = row["numero"] || row["número"] || row["Numero"] || row["Número"];
      number = `${number}`.replace(/[^0-9|-]/g, "");
    }

    if (
      has(row, "email") ||
      has(row, "e-mail") ||
      has(row, "Email") ||
      has(row, "E-mail")
    ) {
      email = row["email"] || row["e-mail"] || row["Email"] || row["E-mail"];
    }

    return { name, number, email, companyId };
  });

  const contactList: Contact[] = [];

  for (const contact of contacts) {
    const [newContact, created] = await Contact.findOrCreate({
      where: {
        number: `${contact.number}`,
        companyId: contact.companyId
      },
      defaults: contact
    });
    if (created) {
      contactList.push(newContact);
    }
  }

  if (contactList) {
    // Validate numbers against WhatsApp in the background. Each CheckContactNumber
    // performs a live Baileys network round-trip; awaiting thousands of them
    // sequentially inside the request holds the HTTP connection open until it
    // times out, so run the validation detached and respond immediately.
    (async () => {
      for (let newContact of contactList) {
        try {
          const response = await CheckContactNumber(
            newContact.number,
            companyId
          );
          const number = response.jid.replace(/[^0-9|-]/g, "");
          newContact.number = number;
          await newContact.save();
        } catch (e) {
          logger.error(`Número de contato inválido: ${newContact.number}`);
        }
      }
    })().catch(e => {
      logger.error(`Erro ao validar contatos importados: ${e}`);
    });
  }

  return contactList;
}
