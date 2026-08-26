import fs from "fs";
import os from "os";
import path from "path";

// baileys e ESM puro e os models puxam a conexao do sequelize: todos os modulos
// externos ao servico entram por factory para o teste rodar isolado.
jest.mock("../../../libs/wbot", () => ({ getWbot: jest.fn() }));
jest.mock("../../../models/Message", () => ({ findAll: jest.fn() }));
jest.mock("../../../models/Contact", () => ({ findOne: jest.fn() }));
jest.mock("../../../models/Whatsapp", () => ({ findOne: jest.fn() }));
jest.mock("../../../helpers/GetDefaultWhatsApp", () => jest.fn());
jest.mock("../../../helpers/getContactJid", () => ({
  getContactJid: () => "5511999999999@s.whatsapp.net"
}));
jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

import ForwardWhatsAppMessage from "../ForwardWhatsAppMessage";
import Contact from "../../../models/Contact";
import Message from "../../../models/Message";
import Whatsapp from "../../../models/Whatsapp";
import { getWbot } from "../../../libs/wbot";

const publicFolder = path.resolve(__dirname, "..", "..", "..", "..", "public");

const sendMessage = jest.fn();

const buildMessage = (overrides: any = {}): any => {
  const values = {
    id: "MSG1",
    body: "",
    mediaType: "application",
    mediaUrl: null,
    dataJson: null,
    ...overrides
  };

  return {
    ...values,
    getDataValue: (key: string) => values[key]
  };
};

const writeFixture = (name: string, content = "conteudo"): string => {
  fs.mkdirSync(publicFolder, { recursive: true });
  const file = path.join(publicFolder, name);
  fs.writeFileSync(file, content);
  return file;
};

const created: string[] = [];

const fixture = (name: string): string => {
  created.push(writeFixture(name));
  return name;
};

describe("ForwardWhatsAppMessage", () => {
  beforeEach(() => {
    sendMessage.mockReset().mockResolvedValue({});
    (getWbot as jest.Mock).mockReturnValue({ sendMessage });
    (Contact.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      companyId: 1,
      number: "5511999999999",
      isGroup: false
    });
    (Whatsapp.findOne as jest.Mock).mockResolvedValue({ id: 7 });
  });

  afterAll(() => {
    created.forEach(f => fs.existsSync(f) && fs.unlinkSync(f));
  });

  const forward = (messages: any[]) => {
    (Message.findAll as jest.Mock).mockResolvedValue(messages);
    return ForwardWhatsAppMessage({
      contactId: 1,
      whatsappId: 7,
      companyId: 1,
      messagesId: messages.map(m => m.id)
    });
  };

  it("envia PDF como documento, com o mimetype e o nome originais", async () => {
    const stored = fixture("1730500000_1a2b3c.pdf");
    const result = await forward([
      buildMessage({
        mediaType: "application",
        mediaUrl: stored,
        body: stored,
        dataJson: JSON.stringify({
          message: {
            documentMessage: {
              mimetype: "application/pdf",
              fileName: "Nota Fiscal 001.pdf"
            }
          }
        })
      })
    ]);

    expect(result.sent).toEqual(["MSG1"]);
    const content = sendMessage.mock.calls[0][1];
    expect(content.document).toBeInstanceOf(Buffer);
    expect(content.mimetype).toBe("application/pdf");
    expect(content.fileName).toBe("Nota Fiscal 001.pdf");
    // o nome interno do arquivo nao deve virar legenda
    expect(content.caption).toBeUndefined();
  });

  it("encaminha documento text/* (csv, txt), que antes era descartado", async () => {
    const stored = fixture("1730500001_relatorio.csv");
    const result = await forward([
      buildMessage({
        id: "MSG_CSV",
        mediaType: "text",
        mediaUrl: stored,
        body: stored,
        dataJson: JSON.stringify({
          message: {
            documentMessage: {
              mimetype: "text/csv",
              fileName: "relatorio.csv"
            }
          }
        })
      })
    ]);

    expect(result.sent).toEqual(["MSG_CSV"]);
    expect(sendMessage.mock.calls[0][1].document).toBeInstanceOf(Buffer);
    expect(sendMessage.mock.calls[0][1].mimetype).toBe("text/csv");
  });

  it("usa mimetype valido quando a extensao e desconhecida", async () => {
    const stored = fixture("1730500002_boleto.rem");
    await forward([
      buildMessage({
        id: "MSG_REM",
        mediaType: "application",
        mediaUrl: stored,
        body: stored,
        dataJson: null
      })
    ]);

    expect(sendMessage.mock.calls[0][1].mimetype).toBe(
      "application/octet-stream"
    );
  });

  it("cai no encaminhamento nativo quando o arquivo local nao existe", async () => {
    const raw = {
      key: { id: "MSG_MISSING" },
      message: { documentMessage: { mimetype: "application/pdf" } }
    };

    const result = await forward([
      buildMessage({
        id: "MSG_MISSING",
        mediaType: "application",
        mediaUrl: "1730500003_sumiu.pdf",
        body: "1730500003_sumiu.pdf",
        dataJson: JSON.stringify(raw)
      })
    ]);

    expect(result.sent).toEqual(["MSG_MISSING"]);
    expect(sendMessage.mock.calls[0][1]).toEqual({ forward: raw });
  });

  it("preserva o formato do audio em vez de forcar ogg/opus", async () => {
    const stored = fixture("1730500004_audio.mp3");
    await forward([
      buildMessage({
        id: "MSG_AUDIO",
        mediaType: "audio",
        mediaUrl: stored,
        body: stored,
        dataJson: JSON.stringify({
          message: { audioMessage: { mimetype: "audio/mpeg", ptt: false } }
        })
      })
    ]);

    const content = sendMessage.mock.calls[0][1];
    expect(content.mimetype).toBe("audio/mpeg");
    expect(content.ptt).toBe(false);
  });

  it("nao le arquivos fora de public/", async () => {
    const outside = path.join(os.tmpdir(), "forward-escape.txt");
    fs.writeFileSync(outside, "segredo");

    const result = await forward([
      buildMessage({
        id: "MSG_ESCAPE",
        mediaType: "application",
        mediaUrl: "../../../../../../tmp/forward-escape.txt",
        body: "x",
        dataJson: null
      })
    ]).catch(err => err);

    expect(sendMessage).not.toHaveBeenCalled();
    expect(result.message).toMatch(/não suportado|não foi possível/i);
    fs.unlinkSync(outside);
  });

  it("encaminha texto normalmente", async () => {
    const result = await forward([
      buildMessage({
        id: "MSG_TXT",
        mediaType: "extendedTextMessage",
        mediaUrl: null,
        body: "olá"
      })
    ]);

    expect(result.sent).toEqual(["MSG_TXT"]);
    expect(sendMessage.mock.calls[0][1]).toEqual({ text: "olá" });
  });
});
