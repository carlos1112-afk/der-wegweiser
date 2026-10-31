/** Test double with staged atomic writes/read-version retries. NOT a Firestore emulator. */
export class MemoryFirestore {
  private documents = new Map<string, any>();
  private revisions = new Map<string, number>();
  seed(path: string, value: any): void {
    this.documents.set(path, structuredClone(value)); this.revisions.set(path, (this.revisions.get(path) ?? 0) + 1);
  }
  value(path: string): any { return structuredClone(this.documents.get(path)); }
  paths(prefix: string): string[] { return [...this.documents.keys()].filter(path => path.startsWith(prefix)); }
  collection(name: string): any {
    return { doc: (id: string) => this.ref(`${name}/${id}`), where: (field: string, _operator: string, value: unknown) => ({
      get: async () => ({ docs: this.paths(`${name}/`).filter(path => this.value(path)?.[field] === value).map(path => this.snapshot(path)) }),
    }) };
  }
  private ref(path: string): any {
    return { path, get: async () => this.snapshot(path), set: async (data: any) => this.seed(path, data) };
  }
  private snapshot(path: string): any {
    return { exists: this.documents.has(path), data: () => this.value(path), ref: this.ref(path) };
  }
  async runTransaction<T>(callback: (transaction: any) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const reads = new Map<string, number>();
      const writes: Array<{ path: string; value: any; create: boolean; merge: boolean }> = [];
      const result = await callback({
        get: async (ref: any) => {
          if (writes.length) throw new Error('READ_AFTER_WRITE');
          reads.set(ref.path, this.revisions.get(ref.path) ?? 0);
          return this.snapshot(ref.path);
        },
        set: (ref: any, value: any, options?: any) => writes.push({ path: ref.path, value, create: false, merge: options?.merge === true }),
        create: (ref: any, value: any) => writes.push({ path: ref.path, value, create: true, merge: false }),
        update: (ref: any, value: any) => writes.push({ path: ref.path, value, create: false, merge: true }),
      });
      if ([...reads].some(([path, revision]) => (this.revisions.get(path) ?? 0) !== revision)) continue;
      if (writes.some(write => write.create && this.documents.has(write.path))) throw new Error('ALREADY_EXISTS');
      for (const write of writes) this.seed(write.path, write.merge ? { ...this.value(write.path), ...write.value } : write.value);
      return result;
    }
    throw new Error('RETRY_EXHAUSTED');
  }
}
