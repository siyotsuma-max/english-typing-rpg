import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const sourceCsvPath = path.join(repoRoot, 'data-source', 'eiken', 'gradepre1', 'gradepre1_master.csv');
const basicMeaningsPath = path.join(repoRoot, 'data-source', 'eiken', 'gradepre1', 'basic-meanings.json');
const outputJsonPath = path.join(repoRoot, 'src', 'data', 'questionSets', 'eiken', 'gradepre1.json');

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

  return rows;
};

const csvText = fs.readFileSync(sourceCsvPath, 'utf8');
const [headerRow, ...dataRows] = parseCsv(csvText).filter((row) => row.some((cell) => cell.trim() !== ''));
const basicMeaningEntries = fs.existsSync(basicMeaningsPath)
  ? JSON.parse(fs.readFileSync(basicMeaningsPath, 'utf8'))
  : [];
const basicMeaningMap = new Map(
  Array.isArray(basicMeaningEntries)
    ? basicMeaningEntries.map((entry) => [`${entry.text}||${entry.translation}`, String(entry.basicMeaning ?? '').trim()])
    : [],
);

if (!headerRow) {
  throw new Error('Master CSV is empty.');
}

const headerIndex = Object.fromEntries(headerRow.map((name, index) => [name, index]));
const requiredColumns = ['text', 'level', 'translation', 'status'];

for (const column of requiredColumns) {
  if (!(column in headerIndex)) {
    throw new Error(`Missing required column: ${column}`);
  }
}

const levels = { 1: [], 2: [], 3: [] };
const stats = {
  skippedBlankText: 0,
  skippedBlankTranslation: 0,
  skippedInvalidLevel: 0,
  skippedNotReady: 0,
};

for (const row of dataRows) {
  const text = (row[headerIndex.text] ?? '').trim();
  const level = (row[headerIndex.level] ?? '').trim();
  const translation = (row[headerIndex.translation] ?? '').trim();
  const exampleJa = (row[headerIndex.exampleJa] ?? '').trim();
  const exampleEn = (row[headerIndex.exampleEn] ?? '').trim();
  const status = (row[headerIndex.status] ?? '').trim();
  const basicMeaning = basicMeaningMap.get(`${text}||${translation}`) ?? '';

  if (status !== 'ready') {
    stats.skippedNotReady += 1;
    continue;
  }

  if (!text) {
    stats.skippedBlankText += 1;
    continue;
  }

  if (!['1', '2', '3'].includes(level)) {
    stats.skippedInvalidLevel += 1;
    continue;
  }

  if (!translation) {
    stats.skippedBlankTranslation += 1;
    continue;
  }

  const nextQuestion = { text, translation };
  if (basicMeaning) nextQuestion.basicMeaning = basicMeaning;
  if (exampleEn) nextQuestion.exampleEn = exampleEn;
  if (exampleJa) nextQuestion.exampleJa = exampleJa;
  levels[level].push(nextQuestion);
}

const output = {
  category: 'eiken',
  series: 'gradepre1',
  difficultyKey: 'EikenPre1',
  displayName: '英検準1級',
  levels,
};

fs.writeFileSync(outputJsonPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  outputJsonPath,
  counts: {
    1: levels[1].length,
    2: levels[2].length,
    3: levels[3].length,
  },
  skipped: stats,
}, null, 2));
