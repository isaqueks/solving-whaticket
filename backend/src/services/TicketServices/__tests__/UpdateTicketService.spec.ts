// Chamado #93: o bot colocar o ticket na fila (cliente escolheu "Falar com
// atendente") não pode marcar a conversa como lida. Os models puxam a conexão
// do sequelize e o baileys é ESM: tudo que o serviço usa entra por factory.
jest.mock("@sentry/node", () => ({ captureException: jest.fn() }));
jest.mock("../../../helpers/CheckContactOpenTickets", () => jest.fn());
jest.mock("../../../helpers/SetTicketMessagesAsRead", () => jest.fn());
jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock("../../../models/Ticket", () => ({}));
jest.mock("../../../models/Setting", () => ({ findOne: jest.fn() }));
jest.mock("../../../models/Queue", () => ({ findByPk: jest.fn() }));
jest.mock("../../../models/Whatsapp", () => ({}));
jest.mock("../../../models/Tag", () => ({}));
jest.mock("../../../models/TicketTag", () => ({}));
jest.mock("../../../models/User", () => ({ findOne: jest.fn() }));
jest.mock("../ShowTicketService", () => jest.fn());
jest.mock("../FindOrCreateATicketTrakingService", () => jest.fn());
jest.mock("../../WhatsappService/ShowWhatsAppService", () => jest.fn());
jest.mock("../../WbotServices/SendWhatsAppMessage", () => jest.fn());
jest.mock("../../WbotServices/wbotMessageListener", () => ({ verifyMessage: jest.fn() }));
jest.mock("../../SettingServices/ListSettingsServiceOne", () => jest.fn());
jest.mock("../../UserServices/ShowUserService", () => jest.fn());
jest.mock("../../../helpers/getContactJid", () => ({ getContactJid: jest.fn() }));

import UpdateTicketService from "../UpdateTicketService";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import ShowTicketService from "../ShowTicketService";
import FindOrCreateATicketTrakingService from "../FindOrCreateATicketTrakingService";
import ListSettingsServiceOne from "../../SettingServices/ListSettingsServiceOne";
import Setting from "../../../models/Setting";
import { getIO } from "../../../libs/socket";

const emit = jest.fn();
const room: any = { to: () => room, emit };

const buildTicket = (): any => ({
  id: 10,
  status: "pending",
  queueId: 1,
  userId: null,
  user: null,
  whatsappId: 3,
  unreadMessages: 2,
  contact: { id: 5, attachedToEmail: null },
  update: jest.fn(),
  reload: jest.fn()
});

describe("UpdateTicketService: marcar como lida (chamado #93)", () => {
  beforeEach(() => {
    (getIO as jest.Mock).mockReturnValue(room);
    (Setting.findOne as jest.Mock).mockResolvedValue(null);
    (ListSettingsServiceOne as jest.Mock).mockResolvedValue(null);
    (FindOrCreateATicketTrakingService as jest.Mock).mockResolvedValue({
      update: jest.fn(),
      save: jest.fn()
    });
  });

  it("marca como lida por padrão (atendente abre, aceita ou transfere)", async () => {
    const ticket = buildTicket();
    (ShowTicketService as jest.Mock).mockResolvedValue(ticket);

    await UpdateTicketService({
      ticketData: { status: "open", userId: 7 },
      ticketId: ticket.id,
      companyId: 2
    });

    expect(SetTicketMessagesAsRead).toHaveBeenCalledWith(ticket);
  });

  it("não marca como lida quando o bot coloca o ticket na fila", async () => {
    const ticket = buildTicket();
    (ShowTicketService as jest.Mock).mockResolvedValue(ticket);

    await UpdateTicketService({
      ticketData: { queueId: 1, chatbot: false },
      ticketId: ticket.id,
      companyId: 2,
      markAsRead: false
    });

    expect(SetTicketMessagesAsRead).not.toHaveBeenCalled();
    // a fila é gravada e unreadMessages não entra no update
    expect(ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ queueId: 1 })
    );
    for (const [values] of ticket.update.mock.calls) {
      expect(values).not.toHaveProperty("unreadMessages");
    }
  });
});
