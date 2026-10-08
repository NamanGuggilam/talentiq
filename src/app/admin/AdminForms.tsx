"use client";
import { useActionState, useState } from "react";
import { addParticipant, addTag, createEvent, createRecruiter, manageRecruiter, type AdminState } from "@/app/actions/admin";

/** Result line for an admin form. A one-time secret (a temporary password) is shown here and nowhere else. */
function Result({ state }: { state: AdminState }) {
  const [copied, setCopied] = useState(false);
  if (!state) return <p role="status" className="min-h-0" />;
  return (
    <div role={state.error ? "alert" : "status"} className="grid gap-2">
      {state.error && <p className="notice" data-tone="bad">{state.error}</p>}
      {state.ok && <p className="notice" data-tone="ok">{state.ok}</p>}
      {state.secret && (
        <div className="rounded-md border border-line-strong bg-raised p-3">
          <p className="eyebrow">{state.secret.label} · shown once</p>
          <p className="mt-1 flex flex-wrap items-center gap-3"><code className="select-all font-mono text-lg font-semibold tracking-wider">{state.secret.value}</code>
            <button type="button" className="btn btn-sm" onClick={async () => { await navigator.clipboard?.writeText(state.secret!.value); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button></p>
          <p className="hint mt-1">Pass it on privately. They should change it from Account after signing in.</p>
        </div>
      )}
    </div>
  );
}

export function NewRecruiterForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(createRecruiter, null);
  return (
    <form action={action} className="grid gap-3 desk:grid-cols-2">
      <div className="field"><label htmlFor="nr-name" className="label">Name</label><input id="nr-name" name="name" required maxLength={120} className="input" autoComplete="off" /></div>
      <div className="field"><label htmlFor="nr-title" className="label">Title <span className="font-normal text-muted">(optional)</span></label><input id="nr-title" name="title" maxLength={120} className="input" autoComplete="off" /></div>
      <div className="field"><label htmlFor="nr-email" className="label">Work email</label><input id="nr-email" name="email" type="email" required className="input" autoComplete="off" /></div>
      <div className="field"><label htmlFor="nr-role" className="label">Role</label><select id="nr-role" name="role" className="input" defaultValue="recruiter"><option value="recruiter">Recruiter or hiring manager</option><option value="coordinator">Coordinator</option></select></div>
      <div className=""><button className="btn btn-ink" disabled={pending} aria-busy={pending}>{pending && <span className="spinner" />}Create account</button></div>
      <div className=""><Result state={state} /></div>
    </form>
  );
}

export function RecruiterRow({ r, self, events }: { r: { id: string; name: string; title: string | null; email: string; role: string; disabled: boolean; met: number; eventId: string | null }; self: boolean; events: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(manageRecruiter, null);
  return (
    <li className="py-4">
      <form action={action} className="grid gap-3 desk:grid-cols-[minmax(0,1fr)_auto] desk:items-center">
        <input type="hidden" name="id" value={r.id} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2"><span className="font-display text-lg font-semibold">{r.name}</span>
            <span className="pill" data-plain="">{r.role}</span>
            {r.disabled && <span className="pill" data-tone="bad">Disabled</span>}
            {self && <span className="pill" data-tone="outline">You</span>}</p>
          <p className="truncate text-sm text-muted">{[r.title, r.email, `${r.met} met`].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button name="intent" value="password" className="btn btn-sm" disabled={pending}>Reset password</button>
          <button name="intent" value="badge" className="btn btn-sm" disabled={pending}>Replace badge link</button>
          {!self && <button name="intent" value="role" className="btn btn-sm" disabled={pending}>Make {r.role === "coordinator" ? "recruiter" : "coordinator"}</button>}
          {!self && <button name="intent" value="toggle" className={`btn btn-sm ${r.disabled ? "" : "btn-danger"}`} disabled={pending}>{r.disabled ? "Enable" : "Disable"}</button>}
          {events.length > 1 && (
            <span className="flex items-center gap-1">
              <label htmlFor={`ev-${r.id}`} className="sr-only">Move {r.name} to event</label>
              <select id={`ev-${r.id}`} name="eventId" defaultValue={r.eventId ?? ""} className="input !min-h-9 !w-auto !py-1 !pl-2.5 !pr-8 text-sm">{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
              <button name="intent" value="move" className="btn btn-sm" disabled={pending}>Move</button>
            </span>
          )}
        </div>
        {state && <div className=""><Result state={state} /></div>}
      </form>
    </li>
  );
}

export function TagForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(addTag, null);
  return (
    <form action={action} className="grid gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="field"><label htmlFor="tag-label" className="label">New tag</label><input id="tag-label" name="label" maxLength={40} required placeholder="Relocation OK" className="input w-56" autoComplete="off" /></div>
        <button className="btn btn-ink" disabled={pending}>Add tag</button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function EventForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(createEvent, null);
  return (
    <form action={action} className="grid gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="field"><label htmlFor="ev-name" className="label">New event</label><input id="ev-name" name="name" maxLength={120} required placeholder="Spring Engineering Career Fair" className="input w-72" autoComplete="off" /></div>
        <div className="field"><label htmlFor="ev-company" className="label">Company shown on badges</label><input id="ev-company" name="company" maxLength={80} defaultValue="J.B. Hunt" className="input w-44" autoComplete="off" /></div>
        <button className="btn btn-ink" disabled={pending}>Create event</button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function ParticipantForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(addParticipant, null);
  return (
    <form action={action} className="grid gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="field"><label htmlFor="p-code" className="label">Participant code</label><input id="p-code" name="code" maxLength={20} required placeholder="P01" className="input w-32 font-mono uppercase" autoComplete="off" /></div>
        <div className="field"><label htmlFor="p-first" className="label">Method used first</label><select id="p-first" name="first" className="input w-44"><option value="paper">Paper</option><option value="talentiq">TalentIQ</option></select></div>
        <button className="btn btn-ink" disabled={pending}>Add participant</button>
      </div>
      <Result state={state} />
    </form>
  );
}
