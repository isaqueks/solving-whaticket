// Chamado #98: o cron mantém atendente = responsável do contato, inclusive
// quando o responsável muda depois que alguém já assumiu o ticket. Os models
// puxam a conexão do sequelize: tudo que o serviço usa entra por factory.
jest.mock("../../../models/Ticket", () => ({ findAll: jest.fn() }));
jest.mock("../../../models/User", () => ({ findOne: jest.fn() }));
jest.mock("../../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock("../../../utils/logger", () => ({ logger: { error: jest.fn() } }));
jest.mock("../../TicketServices/ShowTicketService", () => jest.fn());
jest.mock("../../ContactServices/AttachResponsibleUsers", () => jest.fn());

import { Op } from "sequelize";
import { attachAllTicketsToUser } from "../attachAllTicketsToUser";
import Ticket from "../../../models/Ticket";
import User from "../../../models/User";
import ShowTicketService from "../../TicketServices/ShowTicketService";
import AttachResponsibleUsers from "../../ContactServices/AttachResponsibleUsers";
import { getIO } from "../../../libs/socket";
import { logger } from "../../../utils/logger";

const COMPANY = 2;
const RESPONSIBLE = { id: 7, email: "carol@top.com" };

const emit = jest.fn();
const rooms: string[] = [];
const io: any = {
  to: (r: string) => {
    rooms.push(r);
    return io;
  },
  emit
};

const buildTicket = (over: any = {}): any => ({
  id: 10,
  status: "open",
  queueId: 1,
  userId: null,
  contact: { id: 5, attachedToEmail: RESPONSIBLE.email },
  update: jest.fn(),
  ...over
});

// User.findOne recebe { where: { companyId, email } }
const emailFromQuery = (query: any): string => query.where.email;

const run = async (tickets: any[]) => {
  (Ticket.findAll as jest.Mock).mockResolvedValue(tickets);
  await attachAllTicketsToUser(COMPANY);
};

describe("attachAllTicketsToUser (chamado #98)", () => {
  beforeEach(() => {
    rooms.length = 0;
    (getIO as jest.Mock).mockReturnValue(io);
    (User.findOne as jest.Mock).mockImplementation(async (query: any) =>
      emailFromQuery(query) === RESPONSIBLE.email ? RESPONSIBLE : null
    );
    (ShowTicketService as jest.Mock).mockImplementation(async (id: number) => ({
      id,
      status: "open",
      queueId: null,
      userId: RESPONSIBLE.id,
      user: { id: RESPONSIBLE.id, name: "Carol" },
      contact: { id: 5, attachedToEmail: RESPONSIBLE.email },
      tags: []
    }));
  });

  it("sem atendente e com fila: atribui ao responsável", async () => {
    const ticket = buildTicket({ queueId: 1, userId: null });
    await run([ticket]);

    expect(ticket.update).toHaveBeenCalledWith({ userId: RESPONSIBLE.id });
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("sem atendente e sem fila: não mexe (chatbot de filas ainda atende)", async () => {
    const ticket = buildTicket({ queueId: null, userId: null });
    await run([ticket]);

    expect(ticket.update).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("atendente diferente do responsável, sem fila: troca e emite completo", async () => {
    const ticket = buildTicket({ id: 33, queueId: null, userId: 3 });
    await run([ticket]);

    expect(ticket.update).toHaveBeenCalledWith({ userId: RESPONSIBLE.id });
    expect(ShowTicketService).toHaveBeenCalledWith(33, COMPANY);
    const [[sentContacts]] = (AttachResponsibleUsers as jest.Mock).mock.calls;
    expect(sentContacts[0]).toEqual(expect.objectContaining({ id: 5 }));

    expect(emit).toHaveBeenCalledWith(`company-${COMPANY}-ticket`, {
      action: "update",
      ticket: expect.objectContaining({ id: 33, userId: RESPONSIBLE.id })
    });
    expect(rooms).toEqual(
      expect.arrayContaining([
        `company-${COMPANY}-open`,
        "queue-null-open",
        "33",
        `user-${RESPONSIBLE.id}`,
        "user-3"
      ])
    );
    expect(rooms).not.toContain("open");
  });

  it("atendente igual ao responsável: não mexe nem emite", async () => {
    const ticket = buildTicket({ userId: RESPONSIBLE.id });
    await run([ticket]);

    expect(ticket.update).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("e-mail com caixa diferente não casa (mesma regra do UpdateTicketService)", async () => {
    const ticket = buildTicket({
      userId: 3,
      contact: { id: 5, attachedToEmail: "Carol@TOP.com" }
    });
    await run([ticket]);

    expect(ticket.update).not.toHaveBeenCalled();
  });

  it("e-mail sem usuário na empresa: não mexe", async () => {
    const ticket = buildTicket({
      userId: 3,
      contact: { id: 5, attachedToEmail: "ninguem@top.com" }
    });
    await run([ticket]);

    expect(ticket.update).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("ticket em integração/prompt fica fora da consulta", async () => {
    await run([]);

    const [[query]] = (Ticket.findAll as jest.Mock).mock.calls;
    expect(query.where).toEqual(
      expect.objectContaining({
        companyId: COMPANY,
        status: { [Op.ne]: "closed" },
        isGroup: { [Op.not]: true },
        useIntegration: { [Op.not]: true },
        promptId: { [Op.is]: null }
      })
    );
    const keys = Object.keys(query.where);
    // a fila não é exigida na consulta: o caso 2 vale também sem fila
    expect(keys).not.toContain("queueId");
    expect(keys).not.toContain("userId");
  });

  it("erro em um ticket não interrompe os demais", async () => {
    const broken = buildTicket({ id: 1, userId: 3 });
    broken.update.mockRejectedValue(new Error("boom"));
    const ok = buildTicket({ id: 2, userId: 3 });
    await run([broken, ok]);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(ok.update).toHaveBeenCalledWith({ userId: RESPONSIBLE.id });
  });

  it("consulta o usuário uma vez por e-mail", async () => {
    await run([buildTicket({ id: 1, userId: 3 }), buildTicket({ id: 2, userId: 4 })]);

    expect(User.findOne).toHaveBeenCalledTimes(1);
  });
});
