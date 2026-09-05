import type { AuditWriter } from "../ports/audit-writer";
import type { Repository } from "../ports/repository";

export type Note = {
  id: string;
  content: string;
};

export type CreateNoteInput = {
  id: string;
  content: string;
  actor: string;
};

/**
 * Caso d'uso di prova (Story 1.2, AC#1): dimostra la forma "caso d'uso + port
 * + audit" con dependency injection via costruttore, niente import diretto di
 * adapter concreti.
 */
export class CreateNoteUseCase {
  constructor(
    private readonly repository: Repository<Note, string>,
    private readonly auditWriter: AuditWriter,
  ) {}

  async execute(input: CreateNoteInput): Promise<Note> {
    const note: Note = { id: input.id, content: input.content };
    await this.repository.save(note);
    await this.auditWriter.write({
      actor: input.actor,
      action: "note.created",
      entityType: "Note",
      entityId: note.id,
      timestamp: new Date(),
      // AD-8: l'audit registra metadati, mai il blob di contenuto. Del
      // contenuto va tracciata solo l'orbita (qui: la lunghezza).
      metadataDiff: { contentLength: note.content.length },
    });
    return note;
  }
}
