import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const sourceTxtPath = path.join(repoRoot, 'data-source', 'eiken', 'gradepre1', 'eiken_pre1_filtered_sorted.txt');
const existingJsonPath = path.join(repoRoot, 'src', 'data', 'questionSets', 'eiken', 'gradepre1.json');
const examplesTsPath = path.join(repoRoot, 'src', 'data', 'questionExamples.ts');
const outputCsvPath = path.join(repoRoot, 'data-source', 'eiken', 'gradepre1', 'gradepre1_master.csv');

const csvEscape = (value) => {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const normalizeText = (value) => String(value ?? '').trim();
const normalizeWhitespace = (value) => normalizeText(value).replace(/\u3000/g, ' ').replace(/\s+/g, ' ');

const extractObjectLiteral = (source, constName) => {
  const declaration = `const ${constName}`;
  const start = source.indexOf(declaration);
  if (start === -1) return {};

  const firstBrace = source.indexOf('{', start);
  if (firstBrace === -1) return {};

  let depth = 0;
  let end = -1;

  for (let i = firstBrace; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) return {};

  const objectLiteral = source.slice(firstBrace, end + 1);
  return Function(`"use strict"; return (${objectLiteral});`)();
};

const buildComparableText = (value) => normalizeWhitespace(value)
  .replace(/[［］\[\]（）()]/g, ' ')
  .replace(/[～~]/g, ' ')
  .replace(/\b[ABC]\b/g, ' ')
  .replace(/[^A-Za-z'\- ]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const detectIssues = (value) => {
  const issues = [];
  if (/[～~]/.test(value)) issues.push('placeholder_tilde');
  if (/[［］\[\]（）()]/.test(value)) issues.push('optional_brackets');
  if (/\b[ABC]\b/.test(value)) issues.push('argument_placeholders');
  if (/[^A-Za-z0-9'\- ［］\[\]（）()～~]/.test(value)) issues.push('non_ascii_or_symbols');
  return issues;
};

const isSafeDraftText = (value) => /^[A-Za-z][A-Za-z' -]*[A-Za-z]$/.test(value);

const existingData = JSON.parse(fs.readFileSync(existingJsonPath, 'utf8'));
const examplesSource = fs.readFileSync(examplesTsPath, 'utf8');
const level1Examples = extractObjectLiteral(examplesSource, 'PRE1_LEVEL1_EXAMPLES');
const level2Examples = extractObjectLiteral(examplesSource, 'PRE1_LEVEL2_EXAMPLES');
const existingEntries = new Map();
const existingComparable = new Map();

for (const [level, questions] of Object.entries(existingData.levels ?? {})) {
  for (const question of questions) {
    const text = normalizeText(question.text);
    if (!text) continue;
    const record = {
      sourceText: '',
      text,
      level,
      translation: normalizeText(question.translation),
      exampleEn: normalizeText(
        level === '1'
          ? level1Examples[text]
          : level === '2'
            ? level2Examples[text]
            : ''
          ),
      exampleJa: normalizeText(question.exampleJa),
      status: 'ready',
      issues: '',
      notes: 'existing_json',
    };
    existingEntries.set(text, record);

    const comparable = buildComparableText(text);
    if (!comparable) continue;
    const matches = existingComparable.get(comparable) ?? [];
    matches.push(record);
    existingComparable.set(comparable, matches);
  }
}

const txtEntries = fs
  .readFileSync(sourceTxtPath, 'utf8')
  .split(/\n/)
  .map(normalizeWhitespace)
  .filter(Boolean);

const rawTexts = [...new Set(txtEntries)];
const rows = [];
const coveredExistingTexts = new Set();

for (const sourceText of rawTexts) {
  const exactExisting = existingEntries.get(sourceText);
  const comparable = buildComparableText(sourceText);
  const comparableMatches = comparable ? (existingComparable.get(comparable) ?? []) : [];
  const comparableExisting = !exactExisting && comparableMatches.length === 1
    ? comparableMatches[0]
    : null;
  const matchedExisting = exactExisting ?? comparableExisting;

  if (matchedExisting) {
    coveredExistingTexts.add(matchedExisting.text);
  }

  const issues = detectIssues(sourceText);
  const draftText = normalizeWhitespace(sourceText);
  const suggestedText = matchedExisting?.text
    ?? (issues.length === 0 && isSafeDraftText(draftText) ? draftText : '');
  const inferredLevel = matchedExisting?.level ?? (/\s/.test(draftText) ? '2' : '');
  const status = matchedExisting
    ? 'ready'
    : suggestedText
      ? 'draft'
      : 'needs_review';

  rows.push({
    sourceText,
    text: suggestedText,
    level: inferredLevel,
    translation: matchedExisting?.translation ?? '',
    exampleJa: matchedExisting?.exampleJa ?? '',
    exampleEn: matchedExisting?.exampleEn ?? '',
    status,
    issues: matchedExisting ? '' : issues.join('|'),
    notes: matchedExisting
      ? matchedExisting.text === sourceText
        ? 'matched_existing_exact'
        : 'matched_existing_comparable'
      : 'from_raw_source',
  });
}

for (const existing of existingEntries.values()) {
  if (coveredExistingTexts.has(existing.text)) continue;
  rows.push({
    sourceText: '',
    text: existing.text,
    level: existing.level,
    translation: existing.translation,
    exampleJa: existing.exampleJa,
    exampleEn: existing.exampleEn,
    status: 'ready',
    issues: '',
    notes: 'existing_only',
  });
}

const csvLines = [
  ['sourceText', 'text', 'level', 'translation', 'exampleJa', 'exampleEn', 'status', 'issues', 'notes'].join(','),
  ...rows.map((row) => [
    row.sourceText,
    row.text,
    row.level,
    row.translation,
    row.exampleJa,
    row.exampleEn,
    row.status,
    row.issues,
    row.notes,
  ].map(csvEscape).join(',')),
];

fs.writeFileSync(outputCsvPath, `${csvLines.join('\n')}\n`, 'utf8');

const summary = rows.reduce((acc, row) => {
  const key = row.status;
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({
  outputCsvPath,
  totalRows: rows.length,
  statusCounts: summary,
  populated: {
    translation: rows.filter((row) => row.translation).length,
    exampleEn: rows.filter((row) => row.exampleEn).length,
    exampleJa: rows.filter((row) => row.exampleJa).length,
  },
}, null, 2));
