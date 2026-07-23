import { Request, Response } from "express";
import { head } from "lodash";

import { CreateQueueOptionDto } from "./dtos/CreateQueueOptionDto";
import { ListQueueOptionsFilters } from "./dtos/ListQueueOptionsFilters";
import { UpdateQueueOptionDto } from "./dtos/UpdateQueueOptionDto";
import { QueueOptionsService } from "./QueueOptionsService";

/**
 * Controller fino (doc 04 §3) do sub-recurso QueueOptions (nós do chatbot da
 * fila). Handlers são ARROW PROPERTIES (convenção do template B1).
 */
export class QueueOptionsController {
  constructor(private readonly service = new QueueOptionsService()) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { queueId, queueOptionId, parentId } =
      req.query as unknown as ListQueueOptionsFilters;

    const queueOptions = await this.service.list({
      queueId,
      queueOptionId,
      parentId
    });

    return res.json(queueOptions);
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const queueOption = await this.service.create(
      req.body as CreateQueueOptionDto
    );

    return res.status(200).json(queueOption);
  };

  public show = async (req: Request, res: Response): Promise<Response> => {
    const { queueOptionId } = req.params;

    const queueOption = await this.service.show(queueOptionId);

    return res.status(200).json(queueOption);
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    const { queueOptionId } = req.params;

    const queueOption = await this.service.update(
      queueOptionId,
      req.body as UpdateQueueOptionDto
    );

    return res.status(200).json(queueOption);
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    const { queueOptionId } = req.params;

    await this.service.delete(queueOptionId);

    // Mensagem (com o typo "Delected") preservada do controller legado.
    return res.status(200).json({ message: "Option Delected" });
  };

  public mediaUpload = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { queueOptionId } = req.params;
    const { companyId } = req.user;
    const files = req.files as Express.Multer.File[];
    const file = head(files);

    await this.service.attachMedia(queueOptionId, file, companyId);

    return res.send({ mensagem: "Arquivo Salvo" });
  };

  public deleteMedia = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { queueOptionId } = req.params;

    await this.service.removeMedia(queueOptionId);

    return res.send({ mensagem: "Arquivo excluído" });
  };
}
