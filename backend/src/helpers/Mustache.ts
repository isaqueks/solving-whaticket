import Mustache from "mustache";
import Contact from "../models/Contact";

export const greeting = (): string => {
  const greetings = ["Boa madrugada", "Bom dia", "Boa tarde", "Boa noite"];
  const h = new Date().getHours();
  // eslint-disable-next-line no-bitwise
  return greetings[(h / 6) >> 0];
};

export const firstName = (contact?: Contact): string => {
  if (contact && contact?.name) {
    const nameArr = contact?.name.split(' ');
    return nameArr[0];
  }
  return '';
};

const periodGreeting = (hour: number): string => {
  if (hour < 6) {
    return "Boa madrugada";
  }
  if (hour > 17) {
    return "Boa noite";
  }
  if (hour > 11) {
    return "Boa tarde";
  }
  return "Bom dia";
};

export default (body: string, contact: Contact): string => {
  const Hr = new Date();

  const dd: string = `0${Hr.getDate()}`.slice(-2);
  const mm: string = `0${Hr.getMonth() + 1}`.slice(-2);
  const yy: string = Hr.getFullYear().toString();
  const hh: number = Hr.getHours();
  const min: string = `0${Hr.getMinutes()}`.slice(-2);
  const ss: string = `0${Hr.getSeconds()}`.slice(-2);

  const ms = periodGreeting(hh);

  const protocol = yy + mm + dd + String(hh) + min + ss;

  const hora = `${hh}:${min}:${ss}`;

  const view = {
    firstName: firstName(contact),
    name: contact ? contact.name : "",
    gretting: greeting(),
    greeting: greeting(),
    ms,
    protocol,
    hora
  };
  return Mustache.render(body, view);
};