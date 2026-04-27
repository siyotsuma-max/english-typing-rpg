import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const masterCsvPath = path.join(repoRoot, 'data-source', 'eiken', 'grade4', 'grade4_master.csv');
const batchPathArg = process.argv[2];

if (!batchPathArg) {
  throw new Error('Usage: node scripts/apply-grade4-batch.mjs <batch-json-path>');
}

const batchPath = path.isAbsolute(batchPathArg)
  ? batchPathArg
  : path.join(repoRoot, batchPathArg);

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

const csvEscape = (value) => {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const normalizeText = (value) => String(value ?? '').trim();

const masterRows = parseCsv(fs.readFileSync(masterCsvPath, 'utf8'));
const [headerRow, ...dataRows] = masterRows;
const headerIndex = Object.fromEntries(headerRow.map((name, index) => [name, index]));

const requiredColumns = ['sourceText', 'text', 'level', 'translation', 'exampleJa', 'exampleEn', 'status', 'issues', 'notes'];
for (const column of requiredColumns) {
  if (!(column in headerIndex)) {
    throw new Error(`Master CSV is missing required column: ${column}`);
  }
}

const batchEntries = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
if (!Array.isArray(batchEntries)) {
  throw new Error('Batch file must be a JSON array.');
}

const sourceRowMap = new Map();
const textRowMap = new Map();

for (const row of dataRows) {
  const sourceText = normalizeText(row[headerIndex.sourceText]);
  const text = normalizeText(row[headerIndex.text]);
  if (sourceText) sourceRowMap.set(sourceText, row);
  if (text) textRowMap.set(text, row);
}

let updatedCount = 0;

for (const entry of batchEntries) {
  const sourceText = normalizeText(entry.sourceText);
  const text = normalizeText(entry.text);
  const match = (sourceText && sourceRowMap.get(sourceText)) || (text && textRowMap.get(text));

  if (!match) {
    throw new Error(`No matching row found for batch entry: ${sourceText || text}`);
  }

  const nextValues = {
    sourceText: sourceText || normalizeText(match[headerIndex.sourceText]),
    text,
    level: normalizeText(entry.level),
    translation: normalizeText(entry.translation),
    exampleJa: normalizeText(entry.exampleJa),
    exampleEn: normalizeText(entry.exampleEn),
    status: normalizeText(entry.status || 'ready'),
    issues: normalizeText(entry.issues),
    notes: normalizeText(entry.notes || 'curated_batch'),
  };

  for (const [column, value] of Object.entries(nextValues)) {
    match[headerIndex[column]] = value;
  }

  updatedCount += 1;
}

const csvLines = [
  headerRow.map(csvEscape).join(','),
  ...dataRows.map((row) => headerRow.map((column) => csvEscape(row[headerIndex[column]] ?? '')).join(',')),
];

fs.writeFileSync(masterCsvPath, `${csvLines.join('\n')}\n`, 'utf8');

console.log(JSON.stringify({
  masterCsvPath,
  batchPath,
  updatedCount,
}, null, 2));
