import { Request, Response } from "express";

import { GroupParticipantsService } from "./GroupParticipantsService";

/**
 * Controller fino (doc 04 §3): parse da requisição, escopo de empresa e status
 * code — negócio (validação de grupo, resolução do wbot, sync) fica no service.
 *
 * Convenção do template (B1): handlers são ARROW PROPERTIES da classe —
 * `this` já fica preso à instância, dispensando `.bind` no arquivo de rotas.
 */
export class GroupParticipantsController {
  constructor(private readonly service = new GroupParticipantsService()) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { contactId } = req.params;
    const { companyId } = req.user;

    const participants = await this.service.list({
      contactId: parseInt(contactId, 10),
      companyId
    });

    return res.json(participants);
  };

  public sync = async (req: Request, res: Response): Promise<Response> => {
    const { contactId } = req.params;
    const { companyId } = req.user;
    const { force } = req.query;

    const participants = await this.service.syncForCompany(
      parseInt(contactId, 10),
      companyId,
      force === "true"
    );

    return res.json(participants);
  };
}
