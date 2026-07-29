import { json } from '@sveltejs/kit';

import { createWorkspaceServices } from '$lib/server/composition/workspace-services';
import type { ComparisonSerialized } from '$lib/server/domain/value-objects/comparison';
import { Comparison, ComparisonType } from '$lib/server/domain/value-objects/comparison';
import { GitRef, type GitRefType } from '$lib/server/domain/value-objects/git-ref';
import { getDb, runMigrations } from '$lib/server/infrastructure/database/connection';

import type { RequestHandler } from './$types';

const VALID_COMPARISON_TYPES = Object.values(ComparisonType) as string[];
const VALID_REF_TYPES: GitRefType[] = ['branch', 'commit', 'head', 'working-tree', 'index'];

function getServices() {
  const db = getDb();
  runMigrations(db);
  return createWorkspaceServices(db);
}

function parseComparison(raw: string): Comparison | null {
  try {
    // url.searchParams.get() already returns decoded value
    const parsed = JSON.parse(raw) as ComparisonSerialized;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.base || !parsed.target || !parsed.comparisonType) return null;
    if (!VALID_COMPARISON_TYPES.includes(parsed.comparisonType)) return null;
    if (!VALID_REF_TYPES.includes(parsed.base.type as GitRefType)) return null;
    if (!VALID_REF_TYPES.includes(parsed.target.type as GitRefType)) return null;
    if (typeof parsed.base.value !== 'string' || parsed.base.value.trim() === '') return null;
    if (typeof parsed.target.value !== 'string' || parsed.target.value.trim() === '') return null;

    // The GitRef constructor may throw if the type is not valid — catch and return null
    let base: GitRef;
    let target: GitRef;
    try {
      base = new GitRef(parsed.base.type as GitRefType, parsed.base.value);
      target = new GitRef(parsed.target.type as GitRefType, parsed.target.value);
    } catch {
      return null;
    }

    return new Comparison({
      base,
      target,
      comparisonType: parsed.comparisonType as ComparisonType,
    });
  } catch {
    return null;
  }
}

export const GET: RequestHandler = async ({ params, url }) => {
  const { getUseCase, getFileListUseCase } = getServices();

  const ws = await getUseCase.execute({ id: params.id });
  if (!ws.workspace) {
    return json({ error: 'Workspace not found' }, { status: 404 });
  }

  const comparisonRaw = url.searchParams.get('comparison');
  if (!comparisonRaw) {
    return json({ error: 'Missing comparison query parameter' }, { status: 400 });
  }

  const comparison = parseComparison(comparisonRaw);
  if (!comparison) {
    return json({ error: 'Invalid comparison parameter' }, { status: 400 });
  }

  const result = await getFileListUseCase.execute(ws.workspace.repositoryPath, comparison);

  return json(result);
};
