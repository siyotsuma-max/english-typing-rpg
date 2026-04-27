import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const masterCsvPath = path.join(repoRoot, 'data-source', 'eiken', 'grade4', 'grade4_master.csv');

const parseCsv = (input) => {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }

    if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((value) => value.trim() !== ''));
};

const rows = parseCsv(fs.readFileSync(masterCsvPath, 'utf8'));
const [headerRow, ...dataRows] = rows;
const headerIndex = Object.fromEntries(headerRow.map((name, index) => [name, index]));

const getValue = (row, column) => String(row[headerIndex[column]] ?? '').trim();
const readyRows = dataRows.filter((row) => getValue(row, 'status') === 'ready');
const problems = [];
const warnings = [];
const seenReadyTexts = new Map();

for (const row of readyRows) {
  const sourceText = getValue(row, 'sourceText');
  const text = getValue(row, 'text');
  const level = getValue(row, 'level');
  const translation = getValue(row, 'translation');
  const exampleEn = getValue(row, 'exampleEn');
  const issues = getValue(row, 'issues');

  if (!text) problems.push(`ready row missing text: ${sourceText || '(blank sourceText)'}`);
  if (!['1', '2', '3'].includes(level)) problems.push(`ready row has invalid level for ${text || sourceText}`);
  if (!translation) problems.push(`ready row missing translation: ${text || sourceText}`);
  if (issues) warnings.push(`ready row keeps source issues metadata: ${text || sourceText} -> ${issues}`);
  if (level === '1' && /\s/.test(text)) problems.push(`level 1 row should not contain spaces: ${text}`);
  if (level === '3' && exampleEn && !/[.!?]$/.test(exampleEn)) warnings.push(`level 3 example lacks end punctuation: ${text}`);

  if (text) {
    const key = text.toLowerCase();
    const previous = seenReadyTexts.get(key);
    if (previous) {
      problems.push(`duplicate ready text: ${text} (rows: ${previous} / ${sourceText || text})`);
    } else {
      seenReadyTexts.set(key, sourceText || text);
    }
  }
}

const summary = {
  totalRows: dataRows.length,
  readyRows: readyRows.length,
  draftRows: dataRows.filter((row) => getValue(row, 'status') === 'draft').length,
  needsReviewRows: dataRows.filter((row) => getValue(row, 'status') === 'needs_review').length,
  levelCounts: {
    1: readyRows.filter((row) => getValue(row, 'level') === '1').length,
    2: readyRows.filter((row) => getValue(row, 'level') === '2').length,
    3: readyRows.filter((row) => getValue(row, 'level') === '3').length,
  },
};

console.log(JSON.stringify({ summary, problems, warnings }, null, 2));

if (problems.length > 0) {
  process.exitCode = 1;
}
