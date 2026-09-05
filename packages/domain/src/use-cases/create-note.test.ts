import { describe, expect, it } from "vitest";
import type { AuditEntry, AuditWriter } from "../ports/audit-writer";
import type { Repository } from "../ports/repository";
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

describe("CreateNoteUseCase", () => {
  it("salva la nota tramite il Repository e registra l'evento tramite l'AuditWriter", async () => {
    const repository = new InMemoryNoteRepository();
    const auditWriter = new InMemoryAuditWriter();
    const useCase = new CreateNoteUseCase(repository, auditWriter);

    const note = await useCase.execute({ id: "note-1", content: "ciao", actor: "user-1" });

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
});
