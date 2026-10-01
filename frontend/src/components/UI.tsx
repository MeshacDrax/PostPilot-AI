import { ReactNode } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";

export function PageHeading({ eyebrow, title, description, action }: {
  eyebrow?: string; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}

export function Notice({ message, kind = "error" }: { message: string; kind?: "error" | "success" }) {
  return <div className={`notice ${kind}`} role="status">
    {kind === "success" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
    <span>{message}</span>
  </div>;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <div className="inline-loading"><LoaderCircle className="spinner-icon" size={19} /> {label}</div>;
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-art">✳</div><h3>{title}</h3><p>{detail}</p>{action}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Button({ children, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" | "danger" }) {
  return <button className={`button ${variant} ${className}`} {...props}>{children}</button>;
}
