export default async function setupAuthentication() {
  throw new Error(process.env.UIWITNESS_AUTH_SECRET_CANARY ?? "secret missing");
}
