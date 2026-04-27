This folder stores source material and working files for Eiken Pre-1 data migration.

Files:
- `eiken_pre1_filtered_sorted.txt`: raw imported word list from the user's desktop.
- `gradepre1_master.csv`: working master sheet generated from the raw list and current app JSON.

Workflow:
1. Keep raw imports here unchanged.
2. Use `sourceText` as the original phrase and `text` as the game-safe phrase shown in the app.
3. Only rows with `status=ready` are imported into the app JSON.
4. Edit `gradepre1_master.csv` to fill `level`, `translation`, `exampleJa`, and `exampleEn`.
5. Generate `src/data/questionSets/eiken/gradepre1.json` from the completed master sheet with a follow-up import script.

Commands:
- `node scripts/apply-pre1-batch.mjs data-source/eiken/gradepre1/batches/<batch-file>.json`
- `node scripts/build-pre1-master.mjs`
- `node scripts/build-pre1-json-from-master.mjs`
- `node scripts/validate-pre1-master.mjs`
