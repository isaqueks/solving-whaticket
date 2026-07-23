/**
 * Campo extra de contato (linha de ContactCustomField) como trafega nos DTOs.
 * Substitui as antigas interfaces `ExtraInfo extends ContactCustomField`
 * espalhadas pelos services — o dado real é sempre este trio.
 */
export interface ContactExtraInfoDto {
  id?: number;
  name: string;
  value: string;
}
