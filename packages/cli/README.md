# statecraft-ui

The npm package for the `statecraft` CLI. Statecraft checks public websites or renders configured UI product states with Playwright, captures screenshots and diagnostics, and writes an offline coverage report.

```bash
npm install --save-dev statecraft-ui playwright@1.62.1
npx playwright install chromium
npx statecraft check https://example.com
npx statecraft init
npx statecraft scan
```

`check <url>` needs no Statecraft config. It discovers at most five same-origin HTML pages by default, checks each at mobile/desktop × light/dark, and writes screenshots, schema-v1 JSON, and the kinetic offline report beneath `.statecraft/`. Use `--max-pages <1-20>` to change the bounded discovery budget or `--headed` to watch Chromium. Run it only against websites you own or are authorized to test.

`init` generates `statecraft.config.mts` and `statecraft/scenarios/home/success.mts`, so the starter works without changing npm's default package type.

The package also exports `defineConfig`, `checkPublicSite`, config discovery/loading, initialization, scan orchestration, and report-opening APIs for TypeScript consumers.

See the [Statecraft repository](https://github.com/RujitRaval/statecraft) for configuration, scenario, CI, privacy, and contribution guidance.
