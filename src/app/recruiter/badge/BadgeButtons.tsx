"use client";
import { useState, useSyncExternalStore } from "react";

export function PrintButton() {
  return <button type="button" className="btn" onClick={() => window.print()}>Print badge</button>;
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="btn btn-sm" onClick={async () => { await navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
      <span role="status">{copied ? "Copied" : "Copy link"}</span>
    </button>
  );
}

type NdefWriter = { write(message: { records: { recordType: string; data: string }[] }): Promise<void> };
const noSubscribe = () => () => {};

/** Writes the badge link onto an NFC sticker. Only Chrome on Android can do this; elsewhere the button is not shown. */
export function NfcWriteButton({ url }: { url: string }) {
  const supported = useSyncExternalStore(noSubscribe, () => "NDEFReader" in window, () => false);
  const [msg, setMsg] = useState("");
  if (!supported) return null;
  return (
    <button type="button" className="btn btn-sm" onClick={async () => {
      try {
        setMsg("Hold a blank NFC tag to the back of this phone…");
        const Ctor = (window as unknown as { NDEFReader: new () => NdefWriter }).NDEFReader;
        await new Ctor().write({ records: [{ recordType: "url", data: url }] });
        setMsg("Tag written");
      } catch { setMsg("Could not write the tag"); }
    }}>
      <span role="status">{msg || "Write to NFC tag"}</span>
    </button>
  );
}
