import { writable } from 'svelte/store';

export interface ObservationResult {
  id: string;
  reviewId: string;
  type: string;
  severity: string | null;
  origin: string;
  status: string;
  title: string;
  body: string;
  agentInstruction: string;
  filePath: string | null;
  side: string;
  lineStart: number | null;
  lineEnd: number | null;
  comparisonSnapshotJson: string;
  diffSnapshot: string | null;
  contentHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SelectionInfo {
  filePath: string;
  side: string;
  startLine: number;
  endLine: number;
  rawSnapshot: string;
}

export const observationList = writable<ObservationResult[]>([]);
export const selectedObservation = writable<ObservationResult | null>(null);
export const isPanelOpen = writable(false);
export const isCreating = writable(false);
export const selection = writable<SelectionInfo | null>(null);
export const activeFilePath = writable<string | null>(null);
export const staleStatuses = writable<Record<string, string>>({});
