import { Request, Response } from "express";
import * as Yup from "yup";

import AppError from "../../shared/errors/AppError";
import { CreateTicketNoteDto } from "./dtos/CreateTicketNoteDto";
import { UpdateTicketNoteDto } from "./dtos/UpdateTicketNoteDto";
import { TicketNotesService } from "./TicketNotesService";

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string;
};

type FilteredNotesQuery = {
  contactId: string;
  ticketId: string;
};

/** Contrato mínimo de schema Yup aceito pelo guard de validação. */
interface ValidatableSchema {
  validate(value: unknown): Promise<unknown>;
}

/**
 * Controller fino (doc 04 §3): parse da requisição, validação Yup no boundary,
 * permissão e status code — negócio fica no service. Handlers são ARROW
 * PROPERTIES (convenção do template B1): `this` preso à instância, sem `.bind`.
 */
export class TicketNotesController {
  constructor(private readonly service = new TicketNotesService()) {}

  public index = async (req: Request, res: Response): Promise<Response> => {
    const { searchParam, pageNumber } = req.query as IndexQuery;

    const { ticketNotes, count, hasMore } = await this.service.list({
      searchParam,
      pageNumber
    });

    return res.json({ ticketNotes, count, hasMore });
  };

  public list = async (req: Request, res: Response): Promise<Response> => {
    const ticketNotes = await this.service.findAll();

    return res.status(200).json(ticketNotes);
  };

  public store = async (req: Request, res: Response): Promise<Response> => {
    const { note, contactId, ticketId } = req.body as Omit<
      CreateTicketNoteDto,
      "userId"
    >;
    const { id: userId } = req.user;

    // Validação consolidada no boundary (a antiga estava duplicada no service);
    // código de erro preservado do CreateTicketNoteService original.
    await this.validateSchema(
      Yup.object().shape({
        note: Yup.string()
          .min(3, "ERR_TICKETNOTE_INVALID_NAME")
          .required("ERR_TICKETNOTE_INVALID_NAME")
      }),
      { note }
    );

    const ticketNote = await this.service.create({
      note,
      userId,
      contactId,
      ticketId
    });

    return res.status(200).json(ticketNote);
  };

  public show = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;

    const ticketNote = await this.service.show(id);

    return res.status(200).json(ticketNote);
  };

  public update = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
    const { note } = req.body as UpdateTicketNoteDto;

    await this.validateSchema(
      Yup.object().shape({ note: Yup.string() }),
      { note }
    );

    const ticketNote = await this.service.update(id, { note });

    return res.status(200).json(ticketNote);
  };

  public remove = async (req: Request, res: Response): Promise<Response> => {
    if (req.user.profile !== "admin") {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }

    const { id } = req.params;

    await this.service.delete(id);

    return res.status(200).json({ message: "Observação removida" });
  };

  public findFilteredList = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { contactId, ticketId } = req.query as FilteredNotesQuery;

    const notes = await this.service.findByContactAndTicket({
      contactId,
      ticketId
    });

    return res.status(200).json(notes);
  };

  /** Converte falha de validação Yup em AppError 400 (padrão original). */
  private async validateSchema(
    schema: ValidatableSchema,
    payload: unknown
  ): Promise<void> {
    try {
      await schema.validate(payload);
    } catch (err) {
      throw new AppError(err instanceof Error ? err.message : String(err));
    }
  }
}
