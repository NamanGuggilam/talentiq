"use client";
import { useRef, useTransition } from "react";
import { setStatus } from "@/app/actions/recruiter";
import { RECORD_STATUSES, type RecordStatus } from "@/db/schema";

/** Changing the value saves it straight away. It updates this record only and never moves the page. */
export function StatusSelect({ connectionId, status, disabled, label = "Status" }: { connectionId: string; status: RecordStatus; disabled?: boolean; label?: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  return (
    <form ref={form} action={(fd) => start(() => setStatus(fd))} className="inline-flex items-center gap-2">
      <input type="hidden" name="connectionId" value={connectionId} />
      <label className="sr-only" htmlFor={`status-${connectionId}`}>{label}</label>
      <select id={`status-${connectionId}`} name="status" defaultValue={status} key={status} disabled={disabled || pending} onChange={() => form.current?.requestSubmit()} className="input !min-h-9 !w-auto !py-1 !pl-2.5 !pr-8 text-sm font-medium" data-status={status}>
        {RECORD_STATUSES.map((s) => <option key={s}>{s}</option>)}
      </select>
      <span role="status" className="sr-only">{pending ? "Saving status" : ""}</span>
    </form>
  );
}
