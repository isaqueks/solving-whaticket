import sequelize from "../database";
import { getOnWhatsappNumber } from "../helpers/getOnWhatsappNumber";
import Contact from "../models/Contact";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fixWPP() {
  const [ wrong ] = await sequelize.query(/*sql*/`
    select * from "Contacts" c where c."isGroup" = false and length(c.number) = 13
  `);

  console.log(`[FIX] Found ${wrong.length} contacts with wrong numbers.`);

  const wrongCTT = wrong as Contact[];

  for (const ctt of wrongCTT) {
    console.log(`[FIX] Processing contact ID ${ctt.id} with number ${ctt.number}...`);

    const correctNumber = await getOnWhatsappNumber(ctt.number, ctt.companyId);

    if (!correctNumber) {
      console.log(`[FIX] Contact ID ${ctt.id} number ${ctt.number} not found on WhatsApp. Skipping...`);
      continue;
    }

    if (ctt.number === correctNumber) {
      console.log(`[FIX] Contact ID ${ctt.id} number ${ctt.number} is already correct. Skipping...`);
      continue;
    }

    console.log(`[FIX] Updating contact ID ${ctt.id} number from ${ctt.number} to ${correctNumber}...`);
    // raw update
    await Contact.update(
      { number: correctNumber },
      { where: { id: ctt.id } }
    );

    console.log(`[FIX] Contact ID ${ctt.id} updated successfully.`);

    // sleep to avoid wpp ban
    await sleep((30 + 30 * Math.random()) * 1000);
  }
}