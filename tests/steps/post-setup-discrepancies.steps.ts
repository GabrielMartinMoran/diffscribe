import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Given, Then, When } from 'quickpickle';

interface WorldExtras {
  _rootBlock?: string;
  _darkBlock?: string;
}

interface DiscrepanciesWorld extends WorldExtras {
  tokensContent: string;
  designMdContent: string;
  vitestConfigRaw: string;
  auditResult: Record<string, unknown>;
  packageJson: Record<string, unknown>;
}

const repoRoot = resolve(import.meta.dirname, '../..');

// ── tokens.css ──

Given('el archivo de tokens CSS existe', (world: DiscrepanciesWorld) => {
  const p = resolve(repoRoot, 'src/lib/web/styles/tokens.css');
  if (!existsSync(p)) throw new Error(`tokens.css not found at ${p}`);
  world.tokensContent = readFileSync(p, 'utf-8');
});

When('leo el bloque :root', (world: DiscrepanciesWorld) => {
  const match = world.tokensContent.match(/:root\s*\{([^}]*)\}/s);
  if (!match) throw new Error('No :root block found in tokens.css');
  world._rootBlock = match[1];
});

Then('contiene --shadow-none: none antes de --shadow-sm', (world: DiscrepanciesWorld) => {
  const block = world._rootBlock ?? world._darkBlock;
  if (!block) throw new Error('No block loaded');

  const shadowNoneIdx = block.indexOf('--shadow-none');
  const shadowSmIdx = block.indexOf('--shadow-sm');

  if (shadowNoneIdx === -1) throw new Error('--shadow-none not found in block');
  if (shadowSmIdx === -1) throw new Error('--shadow-sm not found in block');
  if (shadowNoneIdx > shadowSmIdx) throw new Error('--shadow-none appears after --shadow-sm');

  const line = block.slice(shadowNoneIdx, block.indexOf('\n', shadowNoneIdx));
  if (!line.includes('none')) throw new Error(`--shadow-none value is not none: ${line.trim()}`);
});

When('leo el bloque [data-theme="dark"]', (world: DiscrepanciesWorld) => {
  const match = world.tokensContent.match(/\[data-theme=.dark.\]\s*\{([^}]*)\}/s);
  if (!match) throw new Error('No [data-theme="dark"] block found in tokens.css');
  world._darkBlock = match[1];
});

// ── design.md ──

Given('que existe el archivo de diseno', (world: DiscrepanciesWorld) => {
  const p = resolve(repoRoot, 'docs/design.md');
  if (!existsSync(p)) throw new Error(`design.md not found at ${p}`);
  world.designMdContent = readFileSync(p, 'utf-8');
});

Then(
  'la tabla de sombras incluye la fila --shadow-none con valor none',
  (world: DiscrepanciesWorld) => {
    const tableStart = world.designMdContent.indexOf('| `--shadow-none`');
    if (tableStart === -1) throw new Error('--shadow-none row not found in shadow table');
    const line = world.designMdContent.slice(
      tableStart,
      world.designMdContent.indexOf('\n', tableStart),
    );
    if (!line.includes('none'))
      throw new Error(`--shadow-none row does not have value none: ${line.trim()}`);
  },
);

Then(
  'el bloque CSS :root contiene --shadow-none: none antes de --shadow-sm',
  (world: DiscrepanciesWorld) => {
    verifyCssBlockHasShadowNone(world.designMdContent, ':root');
  },
);

Then(
  'el bloque CSS [data-theme="dark"] contiene --shadow-none: none antes de --shadow-sm',
  (world: DiscrepanciesWorld) => {
    verifyCssBlockHasShadowNone(world.designMdContent, '\\[data-theme="dark"\\]');
  },
);

function verifyCssBlockHasShadowNone(content: string, blockSelector: string): void {
  const escaped = blockSelector.replace(/"/g, '\\"');
  const regex = new RegExp(String.raw`${escaped}\s*\{`);
  const match = content.match(regex);
  if (!match || match.index === undefined)
    throw new Error(`CSS block "${blockSelector}" not found in design.md`);

  const blockStart = match.index;
  let depth = 0;
  let blockEnd = blockStart;
  for (let i = blockStart; i < content.length; i++) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') {
      depth--;
      if (depth === 0) {
        blockEnd = i;
        break;
      }
    }
  }
  const block = content.slice(blockStart, blockEnd + 1);

  const shadowNoneIdx = block.indexOf('--shadow-none');
  const shadowSmIdx = block.indexOf('--shadow-sm');

  if (shadowNoneIdx === -1)
    throw new Error(`--shadow-none not found in ${blockSelector} CSS block`);
  if (shadowSmIdx === -1) throw new Error(`--shadow-sm not found in ${blockSelector} CSS block`);
  if (shadowNoneIdx > shadowSmIdx)
    throw new Error(`--shadow-none appears after --shadow-sm in ${blockSelector} CSS block`);

  const line = block.slice(shadowNoneIdx, block.indexOf('\n', shadowNoneIdx));
  if (!line.includes('none'))
    throw new Error(`--shadow-none value is not none in ${blockSelector}: ${line.trim()}`);
}

// ── vitest config ──

Given('existe el archivo de configuracion de Vitest', (world: DiscrepanciesWorld) => {
  const p = resolve(repoRoot, 'vitest.config.ts');
  if (!existsSync(p)) throw new Error(`vitest.config.ts not found at ${p}`);
  world.vitestConfigRaw = readFileSync(p, 'utf-8');
});

When('leo la configuracion de Vitest', () => {
  // content already loaded
});

Then('los proyectos unit e integration tienen includes disjuntos', (world: DiscrepanciesWorld) => {
  const unitIncludes = extractIncludePatterns(world.vitestConfigRaw, 'unit');
  const intIncludes = extractIncludePatterns(world.vitestConfigRaw, 'integration');

  if (unitIncludes.length === 0) throw new Error('No include found for unit project');
  if (intIncludes.length === 0) throw new Error('No include found for integration project');

  for (const u of unitIncludes) {
    for (const i of intIncludes) {
      if (overlappingGlobs(u, i)) {
        throw new Error(`Unit include "${u}" and integration include "${i}" overlap`);
      }
    }
  }
});

Then('el proyecto unit solo incluye tests-unit', (world: DiscrepanciesWorld) => {
  const includes = extractIncludePatterns(world.vitestConfigRaw, 'unit');
  if (!includes.some((i) => i.includes('tests/unit')))
    throw new Error('Unit project does not include tests/unit');
  if (includes.some((i) => i.includes('tests/integration')))
    throw new Error('Unit project includes integration tests');
});

Then('el proyecto integration solo incluye tests-integration', (world: DiscrepanciesWorld) => {
  const includes = extractIncludePatterns(world.vitestConfigRaw, 'integration');
  if (!includes.some((i) => i.includes('tests/integration')))
    throw new Error('Integration project does not include tests/integration');
  if (includes.some((i) => i.includes('tests/unit')))
    throw new Error('Integration project includes unit tests');
});

function extractIncludePatterns(config: string, project: string): string[] {
  const patterns: string[] = [];
  const projectRegex = new RegExp(
    `name:\\s*['"]${project}['"][^}]*include:\\s*\\[([^\\]]+)\\]`,
    's',
  );
  const match = config.match(projectRegex);
  if (match) {
    const strMatches = match[1].matchAll(/['"]([^'"]+)['"]/g);
    for (const m of strMatches) {
      patterns.push(m[1]);
    }
  }
  return patterns;
}

function overlappingGlobs(a: string, b: string): boolean {
  const na = a.replace(/\/\*\*\/\*\.\w+$/, '');
  const nb = b.replace(/\/\*\*\/\*\.\w+$/, '');
  return na === nb || na.startsWith(nb + '/') || nb.startsWith(na + '/');
}

// ── npm audit ──

Given('el proyecto tiene dependencias instaladas', () => {
  const nodeModules = resolve(repoRoot, 'node_modules');
  if (!existsSync(nodeModules)) throw new Error('node_modules not found — run npm install first');
});

When('ejecuto npm audit con salida JSON', (world: DiscrepanciesWorld) => {
  try {
    const output = execSync('npm audit --json', {
      cwd: repoRoot,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    world.auditResult = JSON.parse(output);
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    if (e.stdout) {
      world.auditResult = JSON.parse(e.stdout);
    } else {
      throw new Error(`npm audit failed: ${String(err)}`, { cause: err });
    }
  }
});

Then('el resultado tiene 0 vulnerabilidades critical', (world: DiscrepanciesWorld) => {
  const vulns = world.auditResult?.vulnerabilities as
    Record<string, { severity: string }> | undefined;
  if (!vulns) return;
  const critical = Object.values(vulns).filter((v) => v.severity === 'critical');
  if (critical.length > 0) throw new Error(`Found ${critical.length} critical vulnerabilities`);
});

Then('el resultado tiene 0 vulnerabilidades high', (world: DiscrepanciesWorld) => {
  const vulns = world.auditResult?.vulnerabilities as
    Record<string, { severity: string }> | undefined;
  if (!vulns) return;
  const high = Object.values(vulns).filter((v) => v.severity === 'high');
  if (high.length > 0) throw new Error(`Found ${high.length} high vulnerabilities`);
});

Then('el resultado tiene 0 vulnerabilidades moderate', (world: DiscrepanciesWorld) => {
  const vulns = world.auditResult?.vulnerabilities as
    Record<string, { severity: string }> | undefined;
  if (!vulns) return;
  const moderate = Object.values(vulns).filter((v) => v.severity === 'moderate');
  if (moderate.length > 0) throw new Error(`Found ${moderate.length} moderate vulnerabilities`);
});

// ── package.json scripts ──

Given('existe el archivo package json', (world: DiscrepanciesWorld) => {
  const p = resolve(repoRoot, 'package.json');
  if (!existsSync(p)) throw new Error('package.json not found');
  world.packageJson = JSON.parse(readFileSync(p, 'utf-8'));
});

Then('el script test-unit ejecuta vitest run con project unit', (world: DiscrepanciesWorld) => {
  const scripts = world.packageJson.scripts as Record<string, string>;
  if (!scripts['test:unit']) throw new Error('test:unit script not found');
  if (!scripts['test:unit'].includes('vitest run --project unit')) {
    throw new Error(`test:unit doesn't use --project unit: ${scripts['test:unit']}`);
  }
});

Then(
  'el script test-integration ejecuta vitest run con project integration',
  (world: DiscrepanciesWorld) => {
    const scripts = world.packageJson.scripts as Record<string, string>;
    if (!scripts['test:integration']) throw new Error('test:integration script not found');
    if (!scripts['test:integration'].includes('vitest run --project integration')) {
      throw new Error(
        `test:integration doesn't use --project integration: ${scripts['test:integration']}`,
      );
    }
  },
);
