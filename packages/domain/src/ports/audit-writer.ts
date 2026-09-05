/**
 * Forma canonica AD-8: registra un evento di audit come diff di metadati, mai
 * il blob di contenuto.
 */
export type AuditEntry = {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: Date;
  metadataDiff: Record<string, unknown>;
};

export type AuditWriter = {
  write(entry: AuditEntry): Promise<void>;
};
