/**
 * Contratto minimo coerente con AD-9. La Story 6.2 lo specializzerà su
 * `revalidateTag`/`revalidatePath` per slug; qui basta l'interfaccia.
 */
export type CacheInvalidator = {
  invalidate(key: string): Promise<void>;
};
