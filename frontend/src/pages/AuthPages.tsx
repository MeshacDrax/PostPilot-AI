import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Command, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, errorMessage } from "../services/api";
import { Button, Field, Notice } from "../components/UI";

export function AuthPage({ register = false }: { register?: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (register) await signUp(name, email, password);
      else await signIn(email, password);
      navigate("/app");
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };
  return (
    <div className="auth-page">
      <section className="auth-side">
        <Link to="/" className="brand-lockup"><span className="brand-symbol"><Command size={18} /></span>postpilot<span className="brand-ai">.ai</span></Link>
        <div className="auth-pitch">
          <div className="auth-badge"><Sparkles size={14} /> YOUR CREATIVE CO-PILOT</div>
          <h1>Good content.<br /><em>On repeat.</em></h1>
          <p>Bring your brand voice to every post. Your next great idea is just a few words away.</p>
          <div className="auth-quote">“We went from staring at a blank page to planning a whole month of content in an afternoon.”<span>— A happier marketing team</span></div>
        </div>
        <div className="auth-side-footer">Thoughtful content, made easier.</div>
      </section>
      <section className="auth-main">
        <Link to="/" className="auth-back"><ArrowLeft size={16} /> Back to home</Link>
        <div className="auth-form-wrap">
          <span className="auth-overline">{register ? "LET'S GET STARTED" : "WELCOME BACK"}</span>
          <h2>{register ? "Create your account" : "Sign in to PostPilot"}</h2>
          <p className="auth-subtitle">{register ? "Your next great post starts here." : "Your content studio is ready when you are."}</p>
          {error && <Notice message={error} />}
          <form onSubmit={(event) => void submit(event)} className="form-stack">
            {register && <Field label="Your name"><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Morgan" autoComplete="name" /></Field>}
            <Field label="Email address"><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" /></Field>
            <Field label="Password"><input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={register ? "new-password" : "current-password"} /></Field>
            {!register && <div className="form-aside"><Link to="/forgot-password">Forgot password?</Link></div>}
            <Button type="submit" disabled={busy} className="button-full">{busy ? "Please wait…" : register ? "Create account" : "Sign in"} <span>→</span></Button>
          </form>
          <p className="auth-switch">{register ? "Already have an account?" : "New to PostPilot?"} <Link to={register ? "/login" : "/register"}>{register ? "Sign in" : "Create an account"}</Link></p>
          <p className="legal-copy">By continuing, you agree to our <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.</p>
        </div>
      </section>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const initialToken = params.get("token") ?? "";
  const [token, setToken] = useState(initialToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetMode, setResetMode] = useState(Boolean(initialToken));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const { data } = resetMode
        ? await api.post("/auth/reset-password", { token, password })
        : await api.post("/auth/forgot-password", { email });
      setMessage(data.resetToken ? `Development reset token: ${data.resetToken}` : data.message);
      if (data.resetToken) {
        setToken(data.resetToken);
        setResetMode(true);
      }
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };
  return <div className="auth-page simple-auth">
    <div className="auth-simple-card">
      <Link to="/" className="brand-lockup"><span className="brand-symbol"><Command size={18} /></span>postpilot<span className="brand-ai">.ai</span></Link>
      <h2>{resetMode ? "Choose a new password" : "Reset your password"}</h2>
      <p className="auth-subtitle">{resetMode ? "Set a new password for your account." : "Enter your email and we'll help you get back in."}</p>
      {error && <Notice message={error} />}{message && <Notice message={message} kind="success" />}
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        {resetMode ? <>
          <Field label="Reset token"><input value={token} onChange={(event) => setToken(event.target.value)} required /></Field>
          <Field label="New password"><input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></Field>
        </> : <Field label="Email address"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>}
        <Button disabled={busy} className="button-full">{busy ? "Please wait…" : resetMode ? "Update password" : "Send reset instructions"}</Button>
      </form>
      <Link to="/login" className="auth-back standalone"><ArrowLeft size={16} /> Back to sign in</Link>
    </div>
  </div>;
}
