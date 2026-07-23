// Single source of truth for frontend environment configuration.
//
// Every `process.env.REACT_APP_*` read lives here (see doc 04 §8): the rest of
// the app imports named fields from `appConfig` and never touches `process.env`.
// Defaults are preserved exactly as they were at the call sites before F0a.
//
// Build-time `NODE_ENV` guards may stay inline elsewhere — they are compiled
// away by the bundler and are not runtime app config.
//
// NextJS migration note: swapping `REACT_APP_*` for `NEXT_PUBLIC_*` is a
// single-file change here.

const DEFAULT_LOGIN_URL = "https://solving.com.br/login";

export const appConfig = Object.freeze({
  // REACT_APP_BACKEND_URL — base URL of the backend API and socket server.
  // No default: the app is expected to run against a configured backend.
  backendUrl: process.env.REACT_APP_BACKEND_URL,

  // REACT_APP_LOGIN_URL — external SSO login page used for redirects on
  // unauthenticated/expired sessions; falls back to the Solving login page.
  loginUrl: process.env.REACT_APP_LOGIN_URL || DEFAULT_LOGIN_URL,
});
