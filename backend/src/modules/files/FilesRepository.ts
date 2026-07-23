import { Op, WhereOptions } from "sequelize";

import { FileOptionInput } from "./dtos/FileOptionInput";
import Files from "./models/Files";
import FilesOptions from "./models/FilesOptions";

/** Atributos criáveis de uma lista de arquivos. */
export interface CreateFilesAttributes {
  name: string;
  message: string;
  companyId: number;
}

/** Atributos mutáveis de uma lista de arquivos (subset tocado pelo domínio). */
export interface FilesUpdateAttributes {
  name?: string;
  message?: string;
}

export interface PagedFilesQuery {
  companyId: number;
  searchParam?: string;
  limit: number;
  offset: number;
}

export interface PagedFilesResult {
  records: Files[];
  count: number;
}

export interface OptionMediaAttributes {
  path: string;
  mediaType: string;
}

/**
 * Único ponto de acesso aos models Files e FilesOptions (doc 04 §3). Esconde os
 * nomes plurais herdados (`Files`/`FilesOptions`) atrás de métodos nomeados. Não
 * emite socket nem lança erro de negócio — retorna dados/null e o service decide.
 */
export class FilesRepository {
  public async create(attributes: CreateFilesAttributes): Promise<Files> {
    return Files.create(attributes);
  }

  /** Lista de arquivos com suas opções (ordenadas), escopada por empresa. */
  public async findByIdWithOptions(
    id: string | number,
    companyId: number
  ): Promise<Files | null> {
    return Files.findOne({
      where: { id, companyId },
      include: [
        "options",
        {
          model: FilesOptions,
          as: "options",
          order: [["id", "ASC"]]
        }
      ]
    });
  }

  /** True se já existe outra lista com o mesmo nome na empresa (unicidade). */
  public async existsByName(
    name: string,
    companyId: number
  ): Promise<boolean> {
    const existing = await Files.findOne({ where: { name, companyId } });

    return !!existing;
  }

  /** Listagem paginada por empresa, busca case-insensitive por nome (tela). */
  public async findAndCountPaged(
    query: PagedFilesQuery
  ): Promise<PagedFilesResult> {
    const { companyId, searchParam, limit, offset } = query;

    const { count, rows: records } = await Files.findAndCountAll({
      where: { companyId, ...this.buildSearchWhere(searchParam) },
      limit,
      offset,
      order: [["name", "ASC"]]
    });

    return { records, count };
  }

  /** Lista plana por empresa, sem timestamps (endpoint `/files/list`). */
  public async findAllByCompany(
    companyId: number,
    searchParam?: string
  ): Promise<Files[]> {
    return Files.findAll({
      where: { companyId, ...this.buildSearchWhere(searchParam) },
      order: [["name", "ASC"]],
      attributes: {
        exclude: ["createdAt", "updatedAt"]
      },
      group: ["Files.id"]
    });
  }

  public async update(
    record: Files,
    attributes: FilesUpdateAttributes
  ): Promise<Files> {
    await record.update(attributes);
    await record.reload({
      attributes: ["id", "name", "message", "companyId"],
      include: ["options"]
    });

    return record;
  }

  public async delete(record: Files): Promise<void> {
    await record.destroy();
  }

  /**
   * Apaga as listas da empresa. Correção aprovada de multi-tenancy: o
   * DeleteAllService original fazia `destroy({ where: {} })`, apagando as listas
   * de TODAS as empresas. Agora escopado por companyId.
   */
  public async deleteAll(companyId: number): Promise<void> {
    await Files.destroy({ where: { companyId } });
  }

  public async upsertOption(
    fileId: number,
    option: FileOptionInput
  ): Promise<void> {
    // Sequelize v5 + sequelize-typescript: o typing de upsert rejeita o objeto
    // parcial (por isso o legado usava @ts-ignore). `as any` confinado ao
    // repository conforme doc 04 §4.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await FilesOptions.upsert({ ...option, fileId } as any);
  }

  public async destroyOption(id: number): Promise<void> {
    await FilesOptions.destroy({ where: { id } });
  }

  public async findOption(
    fileId: string | number,
    optionId: string | number
  ): Promise<FilesOptions | null> {
    return FilesOptions.findOne({ where: { fileId, id: optionId } });
  }

  public async updateOption(
    option: FilesOptions,
    attributes: OptionMediaAttributes
  ): Promise<void> {
    await option.update(attributes);
  }

  private buildSearchWhere(searchParam?: string): WhereOptions {
    if (!searchParam) {
      return {};
    }

    return {
      [Op.or]: [{ name: { [Op.like]: `%${searchParam}%` } }]
    };
  }
}
