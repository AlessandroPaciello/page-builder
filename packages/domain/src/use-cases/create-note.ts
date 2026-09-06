import type { AuditWriter } from "../ports/audit-writer";
import type { Repository } from "../ports/repository";
import type { Principal } from "../principal";
import { assertRole } from "../authz";

export type Note = {
  id: string;
  content: string;
};

export type CreateNoteInput = {
  id: string;
  content: string;
  principal: Principal | null;
};

/**
 * Ruoli abilitati alla creazione, coerenti con la matrice RBAC operazionale
 * (creare pagina: Admin/Editor ✅, Cliente ❌). È l'esempio della policy fine
 * nel core: la matrice reale su Page arriva con i casi d'uso di Epic 4/5.
 */
const CREATE_ALLOWED_ROLES: readonly Principal["role"][] = ["ADMIN", "EDITOR"];

/**
 * Caso d'uso di prova (Story 1.2, AC#1): dimostra la forma "caso d'uso + port
 * + audit" con dependency injection via costruttore, niente import diretto di
 * adapter concreti.
 *
 * Story 1.5: accetta un `Principal` (contratto AD-4) invece dello `actor`
 * stringa e applica la policy deny-by-default del core — l'autorizzazione fine
 * è dato di dominio, non decisione dell'adapter.
 */
export class CreateNoteUseCase {
  constructor(
    private readonly repository: Repository<Note, string>,
    private readonly auditWriter: AuditWriter,
  ) {}

  async execute(input: CreateNoteInput): Promise<Note> {
    assertRole(input.principal, CREATE_ALLOWED_ROLES);

    const note: Note = { id: input.id, content: input.content };
    await this.repository.save(note);
    await this.auditWriter.write({
      actor: input.principal.userId,
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
