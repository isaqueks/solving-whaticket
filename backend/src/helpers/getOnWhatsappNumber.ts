import CheckContactNumber from "../services/WbotServices/CheckNumber";

export function getBrazilianNumberVariations(number: string): string[] {
  if (!number.startsWith("55")) {
    return [number];
  }

  if (number.length === 13) {
    const small = number.slice(0, 4) + number.slice(5);
    return [small, number];
  } else if (number.length === 12) {
    const big = number.slice(0, 4) + "9" + number.slice(4);
    return [number, big];
  }

  return [number];

}

export async function getOnWhatsappNumber(
  number: string,
  companyId: number
): Promise<string> {

  const numbers = getBrazilianNumberVariations(number);

  for (const num of numbers) {
    try {
      const onWhatsapp = await CheckContactNumber(num, companyId);
      if (!onWhatsapp?.exists || !onWhatsapp?.jid) {
        throw new Error(`Contact with number ${number} does not exist on WhatsApp.`);
      }
      return onWhatsapp?.jid.split("@")[0];
    }
    catch {
      console.log(`Number ${num} not found on WhatsApp.`);
    }
  }

  return null;
}