import type { WorkspaceListItem } from '$lib/server/application/dto/results/workspace-results';

declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    interface PageData {
      workspaces: WorkspaceListItem[];
    }
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
