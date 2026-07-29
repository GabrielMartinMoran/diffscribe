#!/usr/bin/env node

/**
 * check-bdd-language — Guard: detect Spanish text in BDD artifacts.
 *
 * Checks:
 *   - Gherkin features: specs/features/** / *.feature
 *   - Step definitions: tests/steps/** / *.ts
 *
 * Detects:
 *   1. Diacritics (áéíóúñü¡¿) which are strong indicators of Spanish.
 *   2. A curated wordlist of common Spanish BDD terms that could slip
 *      without diacritics (e.g., "escenario", "registrado", "workspace" as
 *      false-positive safe words are excluded).
 *
 * Whitelist exclusions:
 *   - Technical terms: --shadow-none, prettier, eslint, vitest, etc.
 *   - Paths and filenames: /tmp/diffscribe-fixture/, etc.
 *   - Commands: npm, git, etc.
 *   - CSS properties/values: none, etc.
 *   - Markdown artifact names: docs/design.md, etc.
 *
 * Wordlist is curated to avoid false positives with English terms
 * that coincidentally match Spanish words (e.g. "no", "a", "data").
 */

import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';

const FEATURE_GLOB = 'specs/features/**/*.feature';
const STEPS_GLOB = 'tests/steps/**/*.ts';

const SPANISH_WORDLIST = [
  'escenario',
  'registrado',
  'iniciado',
  'inicializar',
  'archivo',
  'existe',
  'ejecuto',
  'ejecuta',
  'contiene',
  'resultado',
  'configuración',
  'diseño',
  'vulnerabilidades',
  'directorio',
  'configurado',
  'stageados',
  'stageado',
  'formato',
  'salida',
  'distinto',
  'modificados',
  'vuelve',
  'vacía',
  'vacío',
  'iniciar',
  'rechazado',
  'rechazada',
  'rechazo',
  'persiste',
  'registro',
  'consulta',
  'incluye',
  'tiene',
  'dependencias',
  'instaladas',
  'sombras',
  'fila',
  'bloque',
  'disjuntos',
  'repositorio',
  'raíz',
  'indicador',
  'conserva',
  'reparación',
  'repara',
  'vacio',
  'estado',
  'muestra',
  'ningún',
  'selecciona',
  'reinicio',
  'recarga',
  'página',
  'renombra',
  'el usuario',
  'elimina',
  'eliminado',
  'cierra',
  'diálogo',
  'cancelar',
  'foco',
  'presiona',
  'navega',
  'seleccionarlo',
  'animación',
  'animado',
  'movimiento',
  'transiciones',
  'preferencia',
  'sistema',
  'marcado',
  'activo',
  'permanece',
  'desaparece',
  'sigue',
  'existiendo',
  'archivos',
  'campo',
  'tabla',
  'queda',
  'antiguo',
  'envía',
  'debe',
  'enviarse',
  'exactamente',
  'otro',
  'mismo',
  'abrir',
  'intenta',
  'nuevo',
  'recreado',
  'ubicación',
  'fecha',
  'hora',
  'rechazar',
  'límite',
  'caracteres',
  'excede',
  'puede',
  'originales',
  'alterado',
  'listado',
  'actualizado',
  'único',
  'previamente',
  'subdirectorio',
];

/**
 * Normalize a line for wordlist matching:
 * - lowercases
 * - strips Gherkin keywords (Feature, Scenario, Given, When, Then, And, But)
 * - strips Cucumber Expression tokens ({int}, {string})
 * - strips regex anchors and capture groups for comment text
 */
function normalizeLine(line) {
  return line
    .toLowerCase()
    .replace(
      /\b(feature|scenario|scenario\s*outline|background|examples|given|when|then|and|but)\b\s*:?/gi,
      '',
    )
    .replace(/\{[a-z]+\}/g, '')
    .replace(/["']/g, '')
    .replace(/[,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if text contains diacritics (áéíóúñü¡¿).
 */
function hasDiacritics(text) {
  return /[áéíóúñü¡¿]/i.test(text);
}

/**
 * Check if normalized text contains any Spanish wordlist term.
 * Uses word-boundary matching to avoid substring false positives.
 */
function containsSpanishWord(normalizedText) {
  for (const word of SPANISH_WORDLIST) {
    const re = new RegExp(`\\b${word}\\b`, 'i');
    if (re.test(normalizedText)) {
      return word;
    }
  }
  return null;
}

/**
 * Determine if a line in a .ts file is a BDD-relevant line.
 * We only check lines that are step definition patterns or comments.
 */
function isBddRelevantLineTs(line) {
  const trimmed = line.trim();
  // Step definition patterns: Given('...', When("...", Then(/pattern/, etc.
  if (/\b(Given|When|Then|And|But)\s*\(/.test(trimmed)) return true;
  // Comments in step files
  if (trimmed.startsWith('//')) return true;
  // Docblock / block comments
  if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/')) return true;
  return false;
}

/**
 * Get the pattern text from a step definition line.
 * Extracts content between ( and start of , ( or ).)
 */
function extractStepPattern(line) {
  const m = line.match(/\b(?:Given|When|Then|And|But)\s*\(([^)]+)/);
  if (!m) return line.trim();
  let pattern = m[1].trim();
  // Remove surrounding quotes or regex delimiters
  pattern = pattern.replace(/^["'`/]/, '').replace(/["'`/]$/, '');
  return pattern;
}

/**
 * Extract relevant parts of a .feature line for checking.
 * For Gherkin files, we check non-keyword content.
 */
function extractGherkinContent(line) {
  const trimmed = line.trim();
  // Remove leading Gherkin keywords
  return trimmed.replace(
    /^(Feature|Scenario|Scenario Outline|Background|Examples|Given|When|Then|And|But)\s*:?\s*/i,
    '',
  );
}

async function checkFile(filePath, isTs) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (isTs && !isBddRelevantLineTs(line)) continue;

    const relevant = isTs ? extractStepPattern(line) : extractGherkinContent(line);

    // Check diacritics
    if (hasDiacritics(line)) {
      violations.push({
        file: filePath,
        line: lineNum,
        reason: 'diacritic',
        fragment: line.trim().slice(0, 100),
      });
      continue;
    }

    // Check wordlist against relevant content
    const normalized = normalizeLine(relevant);
    if (normalized.length > 0) {
      const matched = containsSpanishWord(normalized);
      if (matched) {
        violations.push({
          file: filePath,
          line: lineNum,
          reason: `wordlist match: "${matched}"`,
          fragment: line.trim().slice(0, 100),
        });
      }
    }
  }

  return violations;
}

async function main() {
  const featureFiles = await Array.fromAsync(glob(FEATURE_GLOB));
  const stepFiles = await Array.fromAsync(glob(STEPS_GLOB));

  const allFiles = [
    ...featureFiles.map((f) => ({ path: f, isTs: false })),
    ...stepFiles.map((f) => ({ path: f, isTs: true })),
  ];

  const allViolations = [];
  for (const { path, isTs } of allFiles) {
    const violations = await checkFile(path, isTs);
    allViolations.push(...violations);
  }

  if (allViolations.length > 0) {
    console.error(
      `\nSPANISH LANGUAGE DETECTED in BDD artifacts (${allViolations.length} violation(s)):\n`,
    );
    for (const v of allViolations) {
      console.error(`  ${v.file}:${v.line} — ${v.reason}`);
      console.error(`    > ${v.fragment}\n`);
    }
    console.error(
      'All Gherkin features and BDD step definitions must be in English.\n' +
        'See AGENTS.md for the BDD language convention.\n',
    );
    process.exit(1);
  }

  console.error('OK: No Spanish detected in BDD artifacts.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error running check-bdd-language:', err);
  process.exit(1);
});
