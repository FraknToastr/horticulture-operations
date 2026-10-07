# Horticulture Program Planner — Independent Review Console

Open `Horticulture_Review_Console.html` directly in a modern browser. No web server, account, external script or network connection is required to view the bundled Stage 0 reports or import further review ZIPs.

## Workflow

1. Stage 0 is already included (8 original review artifacts). Select a document in the left navigation.
2. Use **Import review ZIP** to add incremental Stage 1–8 report packages. You can also import individual Markdown, CSV, JSON and text files. Repeated names from different ZIPs stay separately available under their respective archives.
3. The right-hand contents list tracks scrolling. Select a section to position its heading below the top of the reading pane. Tables and ledgers have local search; diagrams have pan, scroll-wheel zoom, Fit and Reset controls.
4. Imported reports are cached in your browser's localStorage when storage is available. **Export library** generates a JSON backup; **Restore library** reimports it. The initial Stage 0 documents are compiled into the HTML and cannot be lost when clearing imported archives.

## Scope and limitations

This console excludes the Overtime and Workforce Planner. It does not execute code contained in imported report files, and renders imported text with HTML escaping. ZIP imports inspect only `.md`, `.markdown`, `.csv`, `.json`, `.txt`, `.mmd` and `.mermaid` files; binaries and source assets are ignored. The built-in offline Mermaid renderer supports flowcharts (`flowchart` and `graph`, TB/TD/BT/LR/RL) and the patterns used in Stage 0. For unsupported Mermaid syntax, its source is preserved and displayed rather than silently approximated. The Markdown viewer covers review-report headings, lists, inline links/emphasis/code, quotes, fenced code and tables; it is not a complete CommonMark implementation.

Local browser storage has browser-specific size limits and can be cleared by the user or browser. Export a library backup after importing valuable assessment material. No Council operational data should be added to the review library. Imported ZIPs are not executed; only text-bearing artifacts are imported.

## Next stages

Continue producing each assessment stage as Markdown and CSV inside an incremental ZIP. The console will accept additional review packages without rebuilding its standalone HTML file. Stage 1 was authorized but no completed Stage 1 assessment is bundled in this release.
