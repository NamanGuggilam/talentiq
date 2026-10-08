"use client";
import { useFormStatus } from "react-dom";

/** A submit button that shows progress and blocks double submits while its form's action runs. */
export function SubmitButton({ children, className = "btn", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} className={className} disabled={pending || rest.disabled} aria-busy={pending}>
      {pending && <span className="spinner" />}
      {children}
    </button>
  );
}
