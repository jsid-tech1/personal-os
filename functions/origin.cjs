/* Match exact deployment origins; other projects on vercel.app are unrelated sites. */
const DEFAULT_LOCAL_PORT = 8787;

function allowedOrigin(req) {
  const origin = req.headers.origin;
  if (origin === undefined) return true; // Non-browser clients still need a Firebase ID token.
  if (origin === process.env.APP_ORIGIN ||
      origin === "https://personal-os-12b89.web.app" ||
      origin === "https://personal-os-12b89.firebaseapp.com") return true;
  if (process.env.VERCEL === "1") {
    return [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
      .some(host => host && origin === `https://${host}`);
  }
  const port = req.socket?.localPort || Number(process.env.PORT) || DEFAULT_LOCAL_PORT;
  return origin === `http://localhost:${port}` || origin === `http://127.0.0.1:${port}`;
}

module.exports = { allowedOrigin, DEFAULT_LOCAL_PORT };
