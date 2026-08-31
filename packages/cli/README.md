# uiwitness

The npm package for the `uiwitness` CLI. UIWitness checks public websites or renders configured UI product states with Playwright, captures screenshots and diagnostics, and writes an offline coverage report.

```bash
npm install --save-dev uiwitness playwright@1.62.1
npx playwright install chromium
npx uiwitness check https://example.com
npx uiwitness check https://example.com --write-config
npx uiwitness scan
```

`check <url>` needs no UIWitness config. It discovers at most five same-origin HTML pages by default, checks each at mobile/desktop × light/dark, and writes screenshots, schema-v1 JSON, and the kinetic offline report beneath `.uiwitness/`. Use `--max-pages <1-20>` to change the bounded discovery budget or `--headed` to watch Chromium. Add `--write-config` to save an overwrite-safe `statecraft.config.mts` and `statecraft/scenarios/public/default.mts`; the untouched result runs through `npx uiwitness scan`. Run it only against websites you own or are authorized to test.

New `check`, `scan`, and `open` operations use `.uiwitness/report/uiwitness.json` and `.uiwitness/report/index.html`. They never rename, copy, delete, or inspect a pre-existing `.statecraft/` evidence tree. The schema remains version 1, and programmatic report readers continue to accept legacy `.statecraft/artifacts/**` screenshot references without rewriting them.

`init` generates `statecraft.config.mts` and `statecraft/scenarios/home/success.mts`, so the starter works without changing npm's default package type.

The package also exports `defineConfig`, `checkPublicSite`, config discovery/loading, initialization, scan orchestration, and report-opening APIs for TypeScript consumers. Generated public-site scenarios import the narrow `uiwitness/public-site-scenario` helper so they retain the same assertions as Quick Check without copying implementation code.

See the [public website Quick Check guide](https://github.com/RujitRaval/uiwitness/blob/main/docs/open-source/PUBLIC_URL_QUICK_CHECK.md) for the complete first-run and promotion journey. The [UIWitness repository](https://github.com/RujitRaval/uiwitness) contains configuration, scenario, CI, privacy, release-proof, and contribution guidance.
