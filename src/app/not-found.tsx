import Link from "next/link";
import { Mark } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center py-12">
      <div className="shell text-center">
        <span className="inline-block"><Mark size={56} live /></span>
        <p className="eyebrow mt-6">404 · off the route</p>
        <h1 className="mt-2 text-3xl font-bold">We could not find that page</h1>
        <p className="mt-2 text-ink-2">It may have moved, or you may not have access to it.</p>
        <Link href="/" className="btn btn-primary mt-6">Back to TalentIQ</Link>
      </div>
    </div>
  );
}
