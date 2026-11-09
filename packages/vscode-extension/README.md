# MegaloEvolved for VS Code

Megalo language support via the MegaloEvolved language server (highlighting, autocomplete, hover, go-to-definition, diagnostics).

**Build:** `untracked version`

Scripts are `.txt` files. Open one, then set the language mode to **Megalo** (status bar language indicator, or `Change Language Mode`). You’ll get a Megalo version picker; the choice is remembered in `megaloevolved.megaloVersion` (default `107-mcc`).

## Build / install

```bash
npm install
node scripts/write-build-info.mjs   # optional; stamps MEGACROW_BUILD_STRING
npm run package --workspace=megaloevolved
```

CI uploads `megaloevolved-*.vsix` as the `megaloevolved-vscode-extension` artifact (or `…-pr` on pull requests). Install with **Extensions: Install from VSIX…**.

The build string above is stamped at package time and shown on this extension’s details page in VS Code.
