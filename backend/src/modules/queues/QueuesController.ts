import { Request, Response } from "express";
import { head } from "lodash";

import { QueuesService } from "./QueuesService";

/** Corpo aceito em store/update (o frontend envia "" para campos vazios). */
type QueueBody = {
  name: string;
  color: string;
  greetingMessage?: string;
  outOfHoursMessage?: string;
  schedules?: unknown[];
  orderQueue?: number | string;
  integrationId?: number | string;
  promptId?: number | string;
};

/**
 * Controller fino (doc 04 §3): parse da requisição e status code — negócio no
 * service. Handlers são ARROW PROPERTIES (convenção do template B1): `this`
 * preso à instância, sem `.bind` nas rotas.
 */
export class QueuesController {
  constructor(private readonly service = new QueuesService()) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    // Escopo de empresa vem SEMPRE de req.user (fix preservado — a antiga
    // sobreposição por ?companyId da query permitia listar filas de outra
    // empresa e foi removida).
    const { companyId } = req.user;

    const queues = await this.service.list({ companyId });

    return res.status(200).json(queues);
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const body = req.body as QueueBody;

    const queue = await this.service.create({
      ...this.parseQueueBody(body),
      companyId
    });

    return res.status(200).json(queue);
  };

  public show = async (req: Request, res: Response): Promise<Response> => {
    const { queueId } = req.params;
    const { companyId } = req.user;

    const queue = await this.service.show(queueId, companyId);

    return res.status(200).json(queue);
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    const { queueId } = req.params;
    const { companyId } = req.user;
    const body = req.body as QueueBody;

    const queue = await this.service.update(
      queueId,
      this.parseQueueBody(body),
      companyId
    );

    // Status 201 preservado do UpdateQueueController legado.
    return res.status(201).json(queue);
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    const { queueId } = req.params;
    const { companyId } = req.user;

    await this.service.delete(queueId, companyId);

    return res.status(200).send();
  };

  public mediaUpload = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { queueId } = req.params;
    const { companyId } = req.user;
    const files = req.files as Express.Multer.File[];
    const file = head(files);

    await this.service.attachMedia(queueId, file, companyId);

    return res.send({ mensagem: "Arquivo Salvo" });
  };

  public deleteMedia = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { queueId } = req.params;

    await this.service.removeMedia(queueId);

    return res.send({ mensagem: "Arquivo excluído" });
  };

  /** Normaliza os campos "" → null como o controller legado (boundary). */
  private parseQueueBody(body: QueueBody) {
    const {
      name,
      color,
      greetingMessage,
      outOfHoursMessage,
      schedules,
      orderQueue,
      integrationId,
      promptId
    } = body;

    return {
      name,
      color,
      greetingMessage,
      outOfHoursMessage,
      schedules,
      orderQueue: orderQueue === "" ? null : (orderQueue as number | null),
      integrationId:
        integrationId === "" ? null : (integrationId as number | null),
      promptId: promptId === "" ? null : (promptId as number | null)
    };
  }
}
