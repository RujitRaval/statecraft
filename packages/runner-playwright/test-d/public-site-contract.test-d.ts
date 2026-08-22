import { PUBLIC_SITE_CHECK_CONTRACT } from "statecraft-ui-runner-playwright/public-site-contract";

const mobileWidth: 390 = PUBLIC_SITE_CHECK_CONTRACT.viewports.mobile.width;
const lightTheme: "light" = PUBLIC_SITE_CHECK_CONTRACT.themes[0];
const pageErrorsFail: true = PUBLIC_SITE_CHECK_CONTRACT.failOn.pageError;

void mobileWidth;
void lightTheme;
void pageErrorsFail;
