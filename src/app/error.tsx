"use client";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex min-h-[70vh] items-center py-12">
      <div className="shell text-center" role="alert">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="mt-2 text-3xl font-bold">That did not work</h1>
        <p className="mt-2 text-ink-2">Nothing was lost. Try again, and if it keeps happening tell your coordinator{error.digest ? <> and quote <code className="font-mono text-sm">{error.digest}</code></> : null}.</p>
        <button type="button" className="btn btn-primary mt-6" onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
