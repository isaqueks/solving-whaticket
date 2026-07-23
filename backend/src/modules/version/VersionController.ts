import { Request, Response } from "express";

/**
 * Controller fino (doc 04 §3) do módulo Version.
 *
 * Domínio SEM model e SEM regra de negócio: expõe apenas a versão atual da
 * aplicação. Pela regra do template para domínios model-less, as camadas
 * Repository e Service são OMITIDAS (não fabricadas): não há model para o
 * repository tocar nem lógica para o service orquestrar — criar essas camadas
 * "por via das dúvidas" seria exagero (doc 04 §11).
 *
 * Convenção do template (B1): o handler é ARROW PROPERTY da classe — `this`
 * fica preso à instância e o arquivo de rotas passa o método direto, sem `.bind`.
 */
export class VersionController {
  /**
   * Versão atual da aplicação. Hardcoded — comportamento original preservado
   * (não vem de env nem do package.json). Migrar para uma fonte única fica
   * fora do escopo desta fase.
   */
  private readonly version = "4.8.2";

  public index = async (_req: Request, res: Response): Promise<Response> => {
    return res.status(200).json({ version: this.version });
  };
}
