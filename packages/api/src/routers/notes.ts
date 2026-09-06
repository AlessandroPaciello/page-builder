import { CreateNoteUseCase, type AuditEntry, type AuditWriter, type Note, type Repository } from "@app/domain";
import { z } from "zod";

import { protectedProcedure } from "../index";

/**
 * Porte in-memory di prova: la procedura dimostra il flusso
 * Principal→core→authz, NON la persistenza — l'accesso dati concreto arriva
 * con il primo repository reale (Story 4.2, transazione DB della voce
 * deferred-work 1-2). Nessun tocco a Prisma (enforceato dal boundary check).
 */
class InMemoryNoteRepository implements Repository<Note, string> {
  private readonly records = new Map<string, Note>();

  async findById(id: string): Promise<Note | null> {
    return this.records.get(id) ?? null;
  }

  async save(entity: Note): Promise<void> {
    this.records.set(entity.id, entity);
  }
}

class InMemoryAuditWriter implements AuditWriter {
  readonly entries: AuditEntry[] = [];

  async write(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}

// Module-scope: è un fixture di prova condiviso tra le richieste del processo.
// Non è uno store reale e non deve essere trattato come tale.
const createNoteUseCase = new CreateNoteUseCase(new InMemoryNoteRepository(), new InMemoryAuditWriter());

export const notesRouter = {
  /**
   * Prima mutation RPC del sistema (Story 1.5): delega al core, che applica la
   * policy deny-by-default. Gli errori di dominio tipizzati NON vengono
   * tradotti qui: il mapping AD-13 è applicato una volta sola dall'interceptor
   * handler-level `mapDomainErrors` (packages/api/src/errors.ts, cablato in
   * route.ts per RPCHandler e OpenAPIHandler) — nessuna procedura può
   * dimenticarlo.
   */
  create: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        content: z.string(),
      }),
    )
    .handler(({ context, input }) => {
      return createNoteUseCase.execute({
        id: input.id,
        content: input.content,
        principal: context.principal,
      });
    }),
};
