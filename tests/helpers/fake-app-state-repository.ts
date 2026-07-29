import type { AppStateRepository } from '$lib/server/domain/repositories/app-state-repository';

export class FakeAppStateRepository implements AppStateRepository {
  private store: Map<string, string> = new Map();

  get(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.store.set(key, value);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  _clear(): void {
    this.store.clear();
  }
}
