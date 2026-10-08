/** Only same-site relative paths survive, so a crafted ?next= cannot send someone to another site. */
export function safeNext(next: unknown, fallback: string): string {
  return typeof next === "string" && /^\/(?![/\\])[\w\-./?=&%]*$/.test(next) ? next : fallback;
}
