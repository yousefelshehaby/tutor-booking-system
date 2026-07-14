// Deliberately NOT server-only: this plain string constant needs to be
// importable from client components too (to match against a server
// action's error string and show it distinctly), while check.ts itself
// stays server-only since it touches headers()/the database.
export const RATE_LIMIT_MESSAGE = "محاولات كتير في وقت قصير، من فضلك حاول مرة أخرى بعد قليل";
