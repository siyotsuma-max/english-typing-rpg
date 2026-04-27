import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const sourceTxtPath = path.join(repoRoot, 'data-source', 'eiken', 'grade4', 'grade4_candidate_list.txt');
const existingJsonPath = path.join(repoRoot, 'src', 'data', 'questionSets', 'eiken', 'grade4.json');
const outputCsvPath = path.join(repoRoot, 'data-source', 'eiken', 'grade4', 'grade4_master.csv');

const csvEscape = (value) => {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const normalizeText = (value) => String(value ?? '').trim();
const normalizeWhitespace = (value) => normalizeText(value).replace(/\u3000/g, ' ').replace(/\s+/g, ' ');
const normalizeComparable = (value) => normalizeWhitespace(value)
  .replace(/[［］\[\]()（）]/g, ' ')
  .replace(/[～~]/g, ' ')
  .replace(/\b[ABC]\b/g, ' ')
  .replace(/[^A-Za-z0-9'.,!? -]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const detectIssues = (value) => {
  const issues = [];
  if (/[［］\[\]()（）]/.test(value)) issues.push('optional_brackets');
  if (/[～~]/.test(value)) issues.push('placeholder_tilde');
  if (/\b[ABC]\b/.test(value)) issues.push('argument_placeholders');
  if (/[^A-Za-z0-9'.,!? \-［］\[\]()（）～~]/.test(value)) issues.push('non_ascii_or_symbols');
  return issues;
};

const isSentence = (value) => /[.!?]$/.test(value);
const isSafeDraftText = (value) => /^[A-Za-z0-9][A-Za-z0-9'.,!? -]*[A-Za-z0-9.!?]$/.test(value);
const inferLevel = (value) => {
  if (!value) return '';
  if (isSentence(value)) return '3';
  if (value.includes(' ')) return '2';
  return '1';
};

const existingData = JSON.parse(fs.readFileSync(existingJsonPath, 'utf8'));
const existingEntries = new Map();
const existingComparable = new Map();

for (const [level, questions] of Object.entries(existingData.levels ?? {})) {
  for (const question of questions) {
    const text = normalizeText(question.text);
    if (!text) continue;
    const record = {
      sourceText: '',
      text,
      level: String(level),
      translation: normalizeText(question.translation),
      exampleJa: normalizeText(question.exampleJa),
      exampleEn: normalizeText(question.exampleEn),
      status: 'ready',
      issues: '',
      notes: 'existing_json',
    };
    existingEntries.set(text, record);

    const comparable = normalizeComparable(text);
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
  const comparable = normalizeComparable(sourceText);
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
  const inferredLevel = matchedExisting?.level ?? inferLevel(draftText);
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
  acc[row.status] = (acc[row.status] ?? 0) + 1;
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
