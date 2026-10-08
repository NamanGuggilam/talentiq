"use server";
import { redirect } from "next/navigation";
import { and, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db, dbReady, schema } from "@/db";
import { endAllSessions, endSession, requireRecruiter, safeNext, startSession } from "@/lib/auth";
import { hashSecret, normalizeRecoveryCode, verifySecret } from "@/lib/crypto";
import { limitByIp, rateLimit } from "@/lib/rateLimit";

export type FormState = { error?: string; ok?: string; fields?: Record<string, string> } | null;

const Login = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) });

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = Login.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter your email address and password." };
  const { email, password } = parsed.data;
  // Throttle by address and by account, so neither one IP nor one mailbox can be hammered.
  const allowed = (await limitByIp("login", 20, 600)) && (await rateLimit(`login:acct:${email}`, 8, 600));
  if (!allowed) return { error: "Too many sign-in attempts. Wait ten minutes and try again.", fields: { email } };

  await dbReady;
  const [r] = await db.select().from(schema.recruiters).where(eq(schema.recruiters.email, email));
  const ok = await verifySecret(password, r?.passwordHash);
  if (!r || !ok || r.disabledAt) return { error: "That email and password do not match an active account.", fields: { email } };

  await startSession("recruiter", r.id);
  redirect(safeNext(form.get("next"), "/recruiter"));
}

export async function logout() {
  await endSession("recruiter");
  redirect("/");
}

export async function candidateSignOut() {
  await endSession("candidate");
  redirect("/");
}

const Password = z.string().min(12, "Use at least 12 characters.").max(200);

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireRecruiter();
  if (!(await rateLimit(`pw:${me.id}`, 6, 600))) return { error: "Too many attempts. Wait ten minutes and try again." };
  const next = Password.safeParse(form.get("next"));
  if (!next.success) return { error: next.error.issues[0].message };
  if (next.data !== form.get("confirm")) return { error: "The two new passwords do not match." };
  if (!(await verifySecret(String(form.get("current") ?? ""), me.passwordHash))) return { error: "Your current password is not correct." };
  await db.update(schema.recruiters).set({ passwordHash: await hashSecret(next.data) }).where(eq(schema.recruiters.id, me.id));
  // Signing every device out and back in on this one invalidates any session that used the old password.
  await endAllSessions(me.id);
  await startSession("recruiter", me.id);
  return { ok: "Password changed. Other devices have been signed out." };
}

const Find = z.object({ email: z.string().trim().toLowerCase().email().max(200), lastName: z.string().trim().min(1).max(80), code: z.string().trim().min(8).max(40) });

/** Students have no password. On a new device they prove who they are with the recovery code shown once at signup. */
export async function findProfile(_: FormState, form: FormData): Promise<FormState> {
  const parsed = Find.safeParse({ email: form.get("email"), lastName: form.get("lastName"), code: form.get("code") });
  if (!parsed.success) return { error: "Enter your email, last name and recovery code." };
  const { email, lastName, code } = parsed.data;
  const allowed = (await limitByIp("find", 12, 600)) && (await rateLimit(`find:acct:${email}`, 6, 600));
  if (!allowed) return { error: "Too many attempts. Wait ten minutes and try again.", fields: { email, lastName } };

  await dbReady;
  const [c] = await db.select().from(schema.candidates).where(and(eq(schema.candidates.email, email), ilike(schema.candidates.lastName, lastName)));
  const ok = await verifySecret(normalizeRecoveryCode(code), c?.recoveryHash);
  if (!c || !ok) return { error: "Those details do not match a profile. Check the recovery code you saved at signup.", fields: { email, lastName } };

  await startSession("candidate", c.id);
  redirect(safeNext(form.get("next"), "/me"));
}
