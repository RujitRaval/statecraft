/** Fixed matrix and diagnostic policy shared by Quick Check and promoted scans. */
export interface PublicSiteCheckContract {
  readonly failOn: Readonly<{
    consoleError: false;
    failedRequest: false;
    pageError: true;
  }>;
  readonly themes: readonly ["light", "dark"];
  readonly viewports: Readonly<{
    mobile: Readonly<{ height: 844; width: 390 }>;
    desktop: Readonly<{ height: 900; width: 1_440 }>;
  }>;
}

export const PUBLIC_SITE_CHECK_CONTRACT: PublicSiteCheckContract = Object.freeze({
  failOn: Object.freeze({
    consoleError: false,
    failedRequest: false,
    pageError: true,
  }),
  themes: Object.freeze(["light", "dark"] as const),
  viewports: Object.freeze({
    mobile: Object.freeze({ height: 844, width: 390 }),
    desktop: Object.freeze({ height: 900, width: 1_440 }),
  }),
});
