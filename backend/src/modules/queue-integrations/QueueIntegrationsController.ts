import { Request, Response } from "express";

import { CreateQueueIntegrationDto } from "./dtos/CreateQueueIntegrationDto";
import { UpdateQueueIntegrationDto } from "./dtos/UpdateQueueIntegrationDto";
import {
  QueueIntegrationsService,
  queueIntegrationsService
} from "./QueueIntegrationsService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

/**
 * Controller fino (doc 04 §3): parse da requisição e status code — negócio e
 * validação de negócio ficam no service (o legado já validava lá). Handlers
 * são ARROW PROPERTIES (convenção do template B1).
 */
export class QueueIntegrationsController {
  constructor(
    private readonly service: QueueIntegrationsService = queueIntegrationsService
  ) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { searchParam, pageNumber } = req.query as IndexQuery;
    const { companyId } = req.user;

    const { queueIntegrations, count, hasMore } = await this.service.list({
      searchParam,
      pageNumber,
      companyId
    });

    return res.status(200).json({ queueIntegrations, count, hasMore });
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const {
      type,
      name,
      projectName,
      jsonContent,
      language,
      urlN8N,
      typebotExpires,
      typebotKeywordFinish,
      typebotSlug,
      typebotUnknownMessage,
      typebotKeywordRestart,
      typebotRestartMessage
    } = req.body as Omit<CreateQueueIntegrationDto, "companyId">;
    const { companyId } = req.user;

    const queueIntegration = await this.service.create({
      type,
      name,
      projectName,
      jsonContent,
      language,
      urlN8N,
      companyId,
      typebotExpires,
      typebotKeywordFinish,
      typebotSlug,
      typebotUnknownMessage,
      typebotKeywordRestart,
      typebotRestartMessage
    });

    return res.status(200).json(queueIntegration);
  };

  public show = async (req: Request, res: Response): Promise<Response> => {
    const { integrationId } = req.params;
    const { companyId } = req.user;

    const queueIntegration = await this.service.show(integrationId, companyId);

    return res.status(200).json(queueIntegration);
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    const { integrationId } = req.params;
    const integrationData = req.body as UpdateQueueIntegrationDto;
    const { companyId } = req.user;

    const queueIntegration = await this.service.update(
      integrationId,
      integrationData,
      companyId
    );

    return res.status(201).json(queueIntegration);
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    const { integrationId } = req.params;
    const { companyId } = req.user;

    await this.service.delete(integrationId, companyId);

    return res.status(200).send();
  };
}
