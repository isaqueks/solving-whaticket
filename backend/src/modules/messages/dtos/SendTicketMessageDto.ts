import Message from "../models/Message";

/** Entrada de `MessagesService.sendTicketMessage` (POST /messages/:ticketId). */
export interface SendTicketMessageDto {
  ticketId: string;
  companyId: number;
  userId: number;
  body: string;
  quotedMsg?: Message;
  editMsg?: Message;
  medias?: Express.Multer.File[];
}
