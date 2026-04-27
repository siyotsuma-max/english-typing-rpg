This folder stores source material and working files for Eiken Grade 4 data migration.

Files:
- `grade4_candidate_list.txt`: raw imported word / phrase / sentence list from the user.
- `grade4_master.csv`: working master sheet generated from the raw list and current app JSON.
- `batches/`: curated batch files applied to the master sheet.

Workflow:
1. Keep raw imports here unchanged.
2. Use `sourceText` as the original phrase and `text` as the game-safe phrase shown in the app.
3. Only rows with `status=ready` are imported into the app JSON.
4. Edit `grade4_master.csv` to fill `level`, `translation`, and optional examples.
5. Generate `src/data/questionSets/eiken/grade4.json` from the completed master sheet with the build script.

Commands:
- `node scripts/build-grade4-master.mjs`
- `node scripts/apply-grade4-batch.mjs data-source/eiken/grade4/batches/<batch-file>.json`
- `node scripts/validate-grade4-master.mjs`
- `node scripts/build-grade4-json-from-master.mjs`
