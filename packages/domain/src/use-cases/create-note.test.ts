import { describe, expect, it } from "vitest";
import type { AuditEntry, AuditWriter } from "../ports/audit-writer";
import type { Repository } from "../ports/repository";
import type { Principal } from "../principal";
import { CreateNoteUseCase, type Note } from "./create-note";

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

const adminPrincipal: Principal = { userId: "user-1", role: "ADMIN" };
const editorPrincipal: Principal = { userId: "user-2", role: "EDITOR" };
const clientePrincipal: Principal = { userId: "user-3", role: "CLIENTE" };

describe("CreateNoteUseCase", () => {
  it("consente ad ADMIN di salvare la nota tramite il Repository e registra l'evento tramite l'AuditWriter", async () => {
    const repository = new InMemoryNoteRepository();
    const auditWriter = new InMemoryAuditWriter();
    const useCase = new CreateNoteUseCase(repository, auditWriter);

    const note = await useCase.execute({
      id: "note-1",
      content: "ciao",
      principal: adminPrincipal,
    });

    expect(note).toEqual({ id: "note-1", content: "ciao" });
    await expect(repository.findById("note-1")).resolves.toEqual({ id: "note-1", content: "ciao" });
    expect(auditWriter.entries).toHaveLength(1);
    expect(auditWriter.entries[0]).toMatchObject({
      actor: "user-1",
      action: "note.created",
      entityType: "Note",
      entityId: "note-1",
      metadataDiff: { contentLength: 4 },
    });
    // AD-8: il blob di contenuto non deve finire nell'audit entry.
    expect(JSON.stringify(auditWriter.entries[0])).not.toContain("ciao");
    expect(auditWriter.entries[0]?.timestamp).toBeInstanceOf(Date);
  });

  it("consente anche a EDITOR, coerente con la matrice RBAC (creare = ADMIN/EDITOR)", async () => {
    const useCase = new CreateNoteUseCase(new InMemoryNoteRepository(), new InMemoryAuditWriter());

    await expect(
      useCase.execute({ id: "note-2", content: "x", principal: editorPrincipal }),
    ).resolves.toEqual({ id: "note-2", content: "x" });
  });

  it("nega a CLIENTE con ForbiddenError (policy del core, deny-by-default)", async () => {
    const repository = new InMemoryNoteRepository();
    const auditWriter = new InMemoryAuditWriter();
    const useCase = new CreateNoteUseCase(repository, auditWriter);

    await expect(
      useCase.execute({ id: "note-3", content: "x", principal: clientePrincipal }),
    ).rejects.toMatchObject({
      name: "ForbiddenError",
      role: "CLIENTE",
      allowedRoles: ["ADMIN", "EDITOR"],
    });
    // Nessuna scrittura laterale dopo il deny.
    await expect(repository.findById("note-3")).resolves.toBeNull();
    expect(auditWriter.entries).toHaveLength(0);
  });

  it("nega un principal assente con UnauthorizedError", async () => {
    const useCase = new CreateNoteUseCase(new InMemoryNoteRepository(), new InMemoryAuditWriter());

    await expect(
      useCase.execute({ id: "note-4", content: "x", principal: null }),
    ).rejects.toMatchObject({ name: "UnauthorizedError" });
  });
});
