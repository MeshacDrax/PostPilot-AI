import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Heart,
  Pencil, Plus, RefreshCw, Save, Sparkles, Trash2, WandSparkles, X,
} from "lucide-react";
import { api, errorMessage } from "../services/api";
import { useLoad } from "../hooks/useLoad";
import { useAuth } from "../context/AuthContext";
import { localDateTime } from "../utils/dates";
import { Analytics, Brand, CalendarPost, Content, Template } from "../types";
import { Button, EmptyState, Field, Notice, PageHeading, Spinner } from "../components/UI";

const platforms = ["Instagram", "Facebook", "LinkedIn", "X", "TikTok"];
const types = ["Promotional", "Educational", "Informational", "Engagement", "Announcement", "Story", "Product Launch", "Sale/Discount"];
const tones = ["Professional", "Friendly", "Funny", "Persuasive", "Inspirational", "Luxury", "Casual", "Urgent"];
const errorText = (error: unknown) => errorMessage(error);
const platformCharacterGuides: Record<string, number> = {
  Instagram: 2200, Facebook: 63206, LinkedIn: 3000, X: 280, TikTok: 2200,
};

function getDraftInsights(text: string, platform: string, hasAudience: boolean, length: string) {
  const characterLimit = platformCharacterGuides[platform] ?? 3000;
  const minimumWordsByLength = { Short: 51, Medium: 71, Long: 101 } as const;
  const minimumWords = minimumWordsByLength[length as keyof typeof minimumWordsByLength] ?? minimumWordsByLength.Medium;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const firstLine = text.split(/\n/).find((line) => line.trim())?.trim() ?? "";
  const hashtagCount = new Set(text.match(/#[\p{L}\p{N}_]+/gu) ?? []).size;
  const hasCallToAction = /\b(learn more|shop now|buy now|book|sign up|register|discover|explore|visit|try|download|get in touch|share your|comment|tell us|join|order|reserve|contact|click|reply)\b/i.test(text);
  const checks = [
    {
      label: "Requested depth",
      detail: `${words} words; ${words >= minimumWords ? "the selected minimum is met." : `at least ${minimumWords} words are required for a ${length.toLowerCase()} draft.`}`,
      ready: words >= minimumWords,
    },
    {
      label: "Platform length",
      detail: text.length <= characterLimit
        ? `Within the ${characterLimit.toLocaleString()} character guide for ${platform}.`
        : `${(text.length - characterLimit).toLocaleString()} characters over ${platform}'s usual guide; word minimum takes priority.`,
      ready: text.length <= characterLimit,
    },
    {
      label: "Opening line",
      detail: firstLine.length <= 120
        ? `${firstLine.length} characters — easy to scan at a glance.`
        : `${firstLine.length} characters — consider making the opener more concise.`,
      ready: firstLine.length <= 120,
    },
    {
      label: "Audience focus",
      detail: hasAudience ? "An audience is included in your brief." : "Add a target audience to make the message more specific.",
      ready: hasAudience,
    },
    {
      label: "Next step",
      detail: hasCallToAction ? "A call to action appears in the draft." : "Consider ending with one clear action for the reader.",
      ready: hasCallToAction,
    },
    {
      label: "Hashtags",
      detail: hashtagCount ? `${hashtagCount} hashtag${hashtagCount === 1 ? "" : "s"} included; check that each one is relevant.` : "No hashtags yet. Add a few only if they fit your platform and post.",
      ready: hashtagCount > 0,
    },
  ];
  return {
    characterLimit,
    words,
    readingMinutes: Math.max(1, Math.ceil(words / 200)),
    hashtagCount,
    checks,
    suggestions: checks.filter((check) => !check.ready).map((check) => check.detail),
  };
}

function StatCard({ label, value, note, icon, tint = "mint" }: { label: string; value: string | number; note: string; icon: string; tint?: string }) {
  return <article className="stat-card"><div className={`stat-icon ${tint}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></article>;
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, error, loading } = useLoad<Analytics>("/analytics", "analytics");
  const [plan, setPlan] = useState("FREE");
  useEffect(() => { void api.get("/subscription").then(({ data: result }) => setPlan(result.subscription.plan)).catch(() => undefined); }, []);
  return <>
    <PageHeading eyebrow="YOUR CREATIVE HOME BASE" title={`Good to see you, ${user?.name?.split(" ")[0] ?? "there"}.`} description="Here's how your content is coming along." action={<Link to="/app/generate" className="button primary"><Sparkles size={16} /> Generate content</Link>} />
    {error && <Notice message={error} />}
    {loading ? <Spinner label="Gathering your content stats…" /> : data && <>
      <div className="stats-grid">
        <StatCard label="Generated this month" value={data.generatedThisMonth} note="Fresh ideas in motion" icon="✳" />
        <StatCard label="Saved posts" value={data.savedPosts} note="Ready when you are" icon="▤" tint="lavender" />
        <StatCard label="Favorite posts" value={data.favoritePosts} note="Your very best bits" icon="♡" tint="peach" />
        <StatCard label="Generations used" value={`${data.aiUsage} / ${plan === "FREE" ? "5" : plan === "CREATOR" ? "100" : plan === "BUSINESS" ? "500" : "∞"}`} note="This month" icon="✦" tint="yellow" />
      </div>
      <div className="dashboard-grid">
        <section className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">A STEADY RHYTHM</span><h2>Content activity</h2></div><span className="chart-period">Last 6 months</span></div><div className="bar-chart">{data.monthlyActivity.map((item) => <div className="bar-column" key={item.month}><div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(item.count * 13, item.count ? 18 : 5)}%` }} title={`${item.count} posts`} /></div><span>{item.month}</span></div>)}</div><div className="chart-foot"><span><i className="legend-dot" /> Posts created</span><strong>{data.monthlyActivity.reduce((sum, item) => sum + item.count, 0)} posts in 6 months</strong></div></section>
        <section className="panel platform-panel"><div className="panel-heading"><div><span className="eyebrow">WHERE YOU SHOW UP</span><h2>Platforms</h2></div></div>{data.byPlatform.length ? <div className="platform-breakdown">{data.byPlatform.map((item, index) => <div className="platform-row" key={item.name}><span className={`platform-dot platform-${index}`}>{item.name.slice(0, 1)}</span><span>{item.name}</span><strong>{item.count}</strong></div>)}</div> : <div className="small-empty">Your platform mix will appear here as you create.</div>}<Link to="/app/analytics" className="inline-link">See all analytics <ArrowRight size={14} /></Link></section>
      </div>
      <section className="panel recent-panel"><div className="panel-heading"><div><span className="eyebrow">FRESH FROM YOUR STUDIO</span><h2>Recent content</h2></div><Link to="/app/content" className="inline-link">View library <ArrowRight size={14} /></Link></div>{data.recent.length ? <div className="recent-list">{data.recent.map((item) => <article className="recent-row" key={item.id}><span className="recent-platform">{item.platform.slice(0, 1)}</span><div className="recent-copy"><strong>{item.title || item.contentType}</strong><p>{item.text}</p></div><span className="soft-pill">{item.platform}</span><span className="recent-date">{new Date(item.createdAt).toLocaleDateString()}</span></article>)}</div> : <EmptyState title="Your first post is waiting" detail="Start with a thought, and we’ll help you find the words." action={<Link className="button primary" to="/app/generate">Create a post <ArrowRight size={15} /></Link>} />}</section>
    </>}
  </>;
}

type DraftResearch = {
  summary: string;
  searchDepth: "advanced";
  searchedAt: string;
  sources: Array<{ title: string; url: string; domain: string; excerpt: string; publishedDate: string | null }>;
};
type Draft = Content & { variations?: Array<{ id: string; tone: string; text: string }>; research?: DraftResearch };
export function GeneratorPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState({
    platform: "Instagram", contentType: "Promotional", tone: "Friendly", length: "Medium",
    description: params.get("idea") ?? "", audience: "", location: "", price: "",
    callToAction: "", website: "", contactInformation: "", keywords: "",
    campaignGoal: "Engagement", keyMessage: "", hookStyle: "Auto", emojiStyle: "Subtle",
    deepResearch: false,
    brandId: "", templateId: params.get("template") ?? "", variations: false,
  });
  const [researchConfigured, setResearchConfigured] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  const [generationMode, setGenerationMode] = useState<"ai" | "local" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void Promise.all([api.get("/brands"), api.get("/templates")]).then(([brandResponse, templateResponse]) => {
      setBrands(brandResponse.data.brands);
      setTemplates(templateResponse.data.templates);
      const defaultBrand = brandResponse.data.brands.find((brand: Brand) => brand.isDefault);
      if (defaultBrand) setForm((current) => ({ ...current, brandId: current.brandId || defaultBrand.id }));
    }).catch((failure) => setError(errorText(failure)));
    void api.get("/ai/research-connection")
      .then(({ data }) => setResearchConfigured(Boolean(data.research.configured)))
      .catch(() => setResearchConfigured(false));
  }, []);

  const generate = async (event?: FormEvent) => {
    event?.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const { data } = await api.post("/content/generate", form);
      setDraft({ ...data.content, research: data.research as DraftResearch | undefined }); setSelectedVariation(data.content.variations?.[0]?.id ?? null);
      setGenerationMode(data.generationMode ?? "ai");
      setNotice(data.research
        ? `Your researched draft is ready with ${data.research.sources.length} cited sources.`
        : data.generationMode === "local"
          ? "Your draft is ready. Connect an AI provider for AI-powered writing."
          : "Your new draft is ready. Make it yours, then save it to your library.");
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  };
  const changeDraftText = (text: string) => setDraft((current) => current ? { ...current, text } : current);
  const save = async () => {
    if (!draft) return;
    setBusy(true); setError("");
    try {
      const { data } = await api.put(`/content/${draft.id}`, { text: draft.text, title: draft.title, isSaved: true });
      setDraft(data.content); setNotice("Saved to My Content.");
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  };
  const transform = async (action: "improve" | "shorten" | "expand") => {
    if (!draft) return;
    setBusy(true); setError("");
    try {
      const { data } = await api.post(`/content/${action}`, { text: draft.text });
      changeDraftText(data.text); setGenerationMode(data.generationMode ?? "ai"); setNotice("Draft updated. Save your changes when you're happy.");
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    if (!draft) return;
    await navigator.clipboard.writeText(draft.text);
    setNotice("Copied to your clipboard.");
  };
  const addHashtags = async () => {
    if (!draft) return;
    setBusy(true); setError("");
    try {
      const { data } = await api.post("/hashtags/generate", { topic: form.description, platform: form.platform });
      changeDraftText(`${draft.text.trim()}\n\n${data.hashtags.join(" ")}`);
      setNotice("Hashtags added to your draft.");
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  };
  const schedule = async () => {
    if (!draft) return;
    const when = window.prompt("Enter a future date and time (for example, 2026-12-24T10:00)");
    if (!when) return;
    setBusy(true); setError("");
    try {
      await api.post(`/content/${draft.id}/schedule`, { scheduledAt: new Date(when).toISOString() });
      setNotice("Added to your content calendar.");
    } catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  };
  const useVariation = (variation: NonNullable<Draft["variations"]>[number]) => {
    setSelectedVariation(variation.id);
    changeDraftText(variation.text);
  };
  const update = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const selectedBrand = brands.find((brand) => brand.id === form.brandId) ?? brands.find((brand) => brand.isDefault);
  const insights = draft
    ? getDraftInsights(draft.text, draft.platform, Boolean(form.audience.trim() || selectedBrand?.targetAudience?.trim()), form.length)
    : null;
  return <>
    <PageHeading eyebrow="THE WRITING ROOM" title="Let's make something good." description="Set a clear brief, ground your copy in research, and get a draft with useful content checks." />
    {error && <Notice message={error} />}{notice && <Notice message={notice} kind="success" />}
    <div className="generator-layout">
      <form className="panel generator-form" onSubmit={(event) => void generate(event)}>
        <div className="form-section-heading"><span>01</span><div><strong>Set the scene</strong><small>Where will this post live?</small></div></div>
        <div className="field-grid two">
          <Field label="Platform"><select value={form.platform} onChange={(e) => update("platform", e.target.value)}>{platforms.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Content type"><select value={form.contentType} onChange={(e) => update("contentType", e.target.value)}>{types.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Tone"><select value={form.tone} onChange={(e) => update("tone", e.target.value)}>{tones.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Length"><select value={form.length} onChange={(e) => update("length", e.target.value)}>{[
            { value: "Short", label: "Short · 51+ words" },
            { value: "Medium", label: "Medium · 71+ words" },
            { value: "Long", label: "Long · 101+ words" },
          ].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
        </div>
        <div className="form-section-heading section-spaced"><span>02</span><div><strong>What's the story?</strong><small>A little context goes a long way.</small></div></div>
        <Field label="What are you promoting?"><textarea required minLength={3} maxLength={3000} rows={4} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Tell us about your product, launch, idea, or the thing you want people to know…" /></Field>
        <Field label="Brand profile"><select value={form.brandId} onChange={(e) => update("brandId", e.target.value)}><option value="">No brand profile</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}{brand.isDefault ? " · default" : ""}</option>)}</select></Field>
        <div className="field-grid two">
          <Field label="Target audience"><input value={form.audience} onChange={(e) => update("audience", e.target.value)} placeholder="e.g. first-time founders" /></Field>
          <Field label="Location"><input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="City or region" /></Field>
          <Field label="Price"><input value={form.price} onChange={(e) => update("price", e.target.value)} placeholder="Optional" /></Field>
          <Field label="Call to action"><input value={form.callToAction} onChange={(e) => update("callToAction", e.target.value)} placeholder="e.g. Book a demo" /></Field>
          <Field label="Website"><input value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://" /></Field>
          <Field label="Contact information"><input value={form.contactInformation} onChange={(e) => update("contactInformation", e.target.value)} placeholder="Optional" /></Field>
        </div>
        <Field label="Keywords"><input value={form.keywords} onChange={(e) => update("keywords", e.target.value)} placeholder="A few words you want to weave in" /></Field>
        <details className="generator-advanced">
          <summary><span>Advanced creative brief</span><small>Goal, key message, opening style and emoji use</small></summary>
          <div className="field-grid two">
            <Field label="Campaign goal">
              <select value={form.campaignGoal} onChange={(e) => update("campaignGoal", e.target.value)}>
                {["Awareness", "Engagement", "Website traffic", "Lead generation", "Sales", "Community growth"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Opening approach">
              <select value={form.hookStyle} onChange={(e) => update("hookStyle", e.target.value)}>
                {["Auto", "Question", "Bold statement", "Curiosity", "Mini story", "Direct benefit"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Key message to preserve">
              <textarea rows={2} maxLength={500} value={form.keyMessage} onChange={(e) => update("keyMessage", e.target.value)} placeholder="The one thing readers should remember" />
            </Field>
            <Field label="Emoji use">
              <select value={form.emojiStyle} onChange={(e) => update("emojiStyle", e.target.value)}>
                {["None", "Subtle", "Expressive"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <label className="checkbox-row research-option">
              <input type="checkbox" checked={form.deepResearch} onChange={(e) => update("deepResearch", e.target.checked)} />
              <span className="custom-check"><Check size={12} /></span>
              <span><strong>Deep research · Tavily Advanced</strong><small>Search current web sources, ground the copy, and show citations separately.</small></span>
            </label>
            {form.deepResearch && <div className="research-privacy-note">
              {researchConfigured
                ? "The topic description, industry, and campaign goal are sent to Tavily. Audience and contact details are not sent."
                : <>Connect a Tavily API key first. <Link to="/app/settings">Open Settings</Link>. The topic, industry, and goal are sent to Tavily; audience and contact details are not.</>}
              {!researchConfigured && <p>Deep research also needs a connected AI provider to turn sources into a grounded post.</p>}
            </div>}
          </div>
        </details>
        <Field label="Start from a template"><select value={form.templateId} onChange={(e) => update("templateId", e.target.value)}><option value="">No template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></Field>
        <label className="checkbox-row"><input type="checkbox" checked={form.variations} onChange={(e) => update("variations", e.target.checked)} /><span className="custom-check"><Check size={12} /></span><span><strong>Give me a few directions</strong><small>Generate four different tones to choose from</small></span></label>
        <Button type="submit" disabled={busy} className="button-full generate-button"><Sparkles size={17} />{busy ? "Finding the words…" : "Generate my post"}<ArrowRight size={16} /></Button>
        <p className="form-footnote">AI drafts are a starting point. Give them your final human touch.</p>
      </form>
      <section className="panel result-panel">
        <div className="result-header"><div><span className="eyebrow">YOUR DRAFT</span><h2>{draft ? "A fresh first take" : "A little room for an idea"}</h2></div>{draft && <div className="draft-badges"><span className="soft-pill">{draft.platform}</span><span className={`generation-pill ${generationMode ?? "ai"}`}>{generationMode === "local" ? "LOCAL DRAFT" : "AI DRAFT"}</span></div>}</div>
        {!draft ? <EmptyState title="Your next good post starts here" detail="Choose your settings, add a bit of context, and let’s see what we find." /> : <>
          {draft.variations && draft.variations.length > 1 && <div className="variation-tabs">{draft.variations.map((variation) => <button key={variation.id} className={selectedVariation === variation.id ? "selected" : ""} onClick={() => useVariation(variation)} type="button">{variation.tone}</button>)}</div>}
          <textarea className="draft-editor" aria-label="Edit generated social post" value={draft.text} onChange={(e) => changeDraftText(e.target.value)} />
          <div className="editor-meta"><span>{draft.text.length.toLocaleString()} characters</span><span>✦ Your voice, your final edit</span></div>
          {insights && <section className="content-insights" aria-live="polite">
            <div className="insights-heading">
              <div><span className="eyebrow">A QUICK CONTENT CHECK</span><h3>Content insights</h3></div>
              <span className="insights-disclaimer">Practical checks, not performance predictions</span>
            </div>
            <div className="insights-metrics">
              <div><strong>{insights.words}</strong><span>words</span></div>
              <div><strong>{insights.readingMinutes} min</strong><span>estimated read</span></div>
              <div><strong>{insights.hashtagCount}</strong><span>hashtags</span></div>
            </div>
            <div className="platform-fit">
              <div><strong>{draft.platform} length guide</strong><span>{draft.text.length.toLocaleString()} / {insights.characterLimit.toLocaleString()} characters</span></div>
              <div className="platform-fit-track"><span style={{ width: `${Math.min(100, (draft.text.length / insights.characterLimit) * 100)}%` }} /></div>
              {draft.platform === "X" && <small>Character counts are approximate; links and some Unicode characters can count differently on X.</small>}
            </div>
            <ul className="insight-checks">{insights.checks.map((check) => <li key={check.label} className={check.ready ? "ready" : "suggestion"}>
              <span aria-hidden="true">{check.ready ? "✓" : "!"}</span><div><strong>{check.label}</strong><small>{check.detail}</small></div>
            </li>)}</ul>
          </section>}
          {draft.research && <section className="research-report">
            <div className="insights-heading">
              <div><span className="eyebrow">TAVILY · ADVANCED SEARCH</span><h3>Research & sources</h3></div>
              <span className="research-timestamp">{new Date(draft.research.searchedAt).toLocaleString()}</span>
            </div>
            {draft.research.summary && <p className="research-summary">{draft.research.summary}</p>}
            <p className="research-grounding-note">The post is grounded in these results. Review each source before publishing or repeating factual claims.</p>
            <div className="research-source-list">{draft.research.sources.map((source, index) => <article className="research-source" key={`${source.url}-${index}`}>
              <div className="research-source-meta"><span>Source {index + 1}</span><span>{source.domain}{source.publishedDate ? ` · ${source.publishedDate}` : ""}</span></div>
              <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} <ArrowRight size={12} /></a>
              <p>{source.excerpt}</p>
            </article>)}</div>
          </section>}
          <div className="editor-tools">
            <button onClick={() => void transform("improve")} disabled={busy}><WandSparkles size={15} /> Improve</button>
            <button onClick={() => void transform("shorten")} disabled={busy}><span>↘</span> Shorten</button>
            <button onClick={() => void transform("expand")} disabled={busy}><span>↗</span> Expand</button>
          </div>
          <div className="result-actions"><Button onClick={() => void save()} disabled={busy}><Save size={16} /> Save post</Button><Button variant="secondary" onClick={() => void copy()}><Copy size={16} /> Copy</Button></div>
          <div className="result-secondary-actions"><button onClick={() => void addHashtags()} disabled={busy}><span>#</span> Add hashtags</button><button onClick={() => void schedule()} disabled={busy}><CalendarDays size={15} /> Schedule</button><button onClick={() => void generate()} disabled={busy}><RefreshCw size={15} /> Try again</button></div>
          {busy && <Spinner label="Your co-pilot is thinking…" />}
        </>}
      </section>
    </div>
  </>;
}

function ContentCard({ item, onEdit, onDelete, onFavorite, onSave }: {
  item: Content; onEdit: () => void; onDelete: () => void; onFavorite: () => void; onSave: () => void;
}) {
  const copy = async () => navigator.clipboard.writeText(item.text);
  return <article className="content-card"><div className="content-card-top"><span className="soft-pill">{item.platform}</span><span className="content-date">{new Date(item.createdAt).toLocaleDateString()}</span></div><h3>{item.title || item.contentType}</h3><p className="content-preview">{item.text}</p><div className="content-card-meta"><span>{item.contentType}</span><span>·</span><span>{item.tone}</span></div><div className="content-card-actions"><button onClick={() => void copy()} title="Copy post"><Copy size={15} /></button><button onClick={onFavorite} title={item.favorite ? "Remove favorite" : "Add favorite"} className={item.favorite ? "favorited" : ""}><Heart size={15} fill={item.favorite ? "currentColor" : "none"} /></button>{!item.isSaved && <button onClick={onSave} title="Save post"><Save size={15} /></button>}<span className="action-spacer" /><button onClick={onEdit}>Edit</button><button className="delete-action" onClick={onDelete} title="Delete post"><Trash2 size={15} /></button></div></article>;
}

export function LibraryPage() {
  const [items, setItems] = useState<Content[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [contentType, setContentType] = useState("");
  const [saved, setSaved] = useState("true");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Content | null>(null);
  const [draftText, setDraftText] = useState("");
  const [message, setMessage] = useState("");
  const reload = async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.get("/content", { params: {
        page, pageSize: 9, search: search || undefined, platform: platform || undefined,
        contentType: contentType || undefined, saved: saved || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(new Date(to).setHours(23, 59, 59, 999)).toISOString() : undefined,
      } });
      setItems(data.items); setPages(data.pagination.pages); setTotal(data.pagination.total);
    } catch (failure) { setError(errorText(failure)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, [page, search, platform, contentType, saved, from, to]);
  const remove = async (item: Content) => {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    try { await api.delete(`/content/${item.id}`); setMessage("Post deleted."); await reload(); }
    catch (failure) { setError(errorText(failure)); }
  };
  const favorite = async (item: Content) => {
    try { await api.post(`/content/${item.id}/favorite`, { favorite: !item.favorite }); await reload(); }
    catch (failure) { setError(errorText(failure)); }
  };
  const save = async (item: Content) => {
    try { await api.post(`/content/${item.id}/save`); await reload(); }
    catch (failure) { setError(errorText(failure)); }
  };
  const saveEdit = async () => {
    if (!editing) return;
    try { await api.put(`/content/${editing.id}`, { text: draftText }); setEditing(null); setMessage("Your edits are saved."); await reload(); }
    catch (failure) { setError(errorText(failure)); }
  };
  return <>
    <PageHeading eyebrow="YOUR IDEA LIBRARY" title="My content" description="All your drafts and saved posts, right where you left them." action={<Link to="/app/generate" className="button primary"><Plus size={16} /> New post</Link>} />
    {error && <Notice message={error} />}{message && <Notice message={message} kind="success" />}
    <section className="panel library-panel">
      <div className="library-toolbar">
        <div className="search-box"><span>⌕</span><input placeholder="Find a post…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
        <select aria-label="Filter by platform" value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1); }}><option value="">All platforms</option>{platforms.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter by content type" value={contentType} onChange={(e) => { setContentType(e.target.value); setPage(1); }}><option value="">All content types</option>{types.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter saved posts" value={saved} onChange={(e) => { setSaved(e.target.value); setPage(1); }}><option value="true">Saved posts</option><option value="">All drafts</option><option value="false">Drafts only</option></select>
        <input className="date-filter" aria-label="Filter from date" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <input className="date-filter" aria-label="Filter through date" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
      </div>
      {loading ? <Spinner label="Finding your posts…" /> : items.length ? <>
        <div className="library-results">{total} {total === 1 ? "post" : "posts"}</div>
        <div className="content-grid">{items.map((item) => <ContentCard key={item.id} item={item} onEdit={() => { setEditing(item); setDraftText(item.text); }} onDelete={() => void remove(item)} onFavorite={() => void favorite(item)} onSave={() => void save(item)} />)}</div>
        <div className="pagination"><span>Page {page} of {Math.max(1, pages)}</span><div><button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={18} /></button><button onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages} aria-label="Next page"><ChevronRight size={18} /></button></div></div>
      </> : <EmptyState title={saved === "true" ? "No saved posts yet" : "Nothing in this corner yet"} detail={search ? "Try a different search or loosen those filters." : "Your ideas will show up here when you save or generate a post."} action={<Link to="/app/generate" className="button primary">Create your first post <ArrowRight size={15} /></Link>} />}
    </section>
    {editing && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}><div className="modal-card"><div className="modal-heading"><div><span className="eyebrow">EDIT YOUR POST</span><h2>Make it yours.</h2></div><button className="icon-button" onClick={() => setEditing(null)}><X size={18} /></button></div><textarea rows={10} value={draftText} onChange={(e) => setDraftText(e.target.value)} /><div className="modal-actions"><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={() => void saveEdit()}><Save size={15} /> Save edits</Button></div></div></div>}
  </>;
}

export function TemplatesPage() {
  const { data, error, loading } = useLoad<Template[]>("/templates", "templates");
  const navigate = useNavigate();
  return <>
    <PageHeading eyebrow="A GOOD PLACE TO BEGIN" title="Templates" description="A helpful nudge for every kind of post. Pick one and make it your own." />
    {error && <Notice message={error} />}
    {loading ? <Spinner /> : data?.length ? <div className="template-grid">{data.map((template, index) => <article className="template-card" key={template.id}><div className={`template-art art-${index % 6}`}><span>{["✳", "↗", "◷", "⌁", "✦", "♡"][index % 6]}</span><small>{template.category}</small></div><div className="template-copy"><div className="template-labels"><span className="eyebrow">{template.category}</span>{template.isPremium && <span className="premium-pill">CREATOR+</span>}</div><h3>{template.name}</h3><p>{template.description}</p><button className="text-link" onClick={() => navigate(`/app/generate?template=${template.id}`)}>Use this template <ArrowRight size={15} /></button></div></article>)}</div> : <EmptyState title="Templates are getting ready" detail="Check back soon." />}
  </>;
}

export function IdeasPage() {
  const [form, setForm] = useState({ industry: "", platform: "Instagram", audience: "", goal: "" });
  const [ideas, setIdeas] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const generate = async () => {
    setBusy(true); setError("");
    try { const { data } = await api.post("/ideas/generate", form); setIdeas(data.ideas); }
    catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void generate(); };
  return <>
    <PageHeading eyebrow="A SPARK TO GET YOU STARTED" title="Content ideas" description="Ten fresh angles, tailored to your audience, industry, and goals." />
    {error && <Notice message={error} />}
    <div className="tool-layout"><form className="panel tool-form" onSubmit={(event) => void submit(event)}><div className="form-section-heading"><span>✳</span><div><strong>What are we dreaming up?</strong><small>A few details help make the ideas more useful.</small></div></div><Field label="Industry"><input required value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="e.g. independent skincare" /></Field><Field label="Platform"><select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>{platforms.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Target audience"><input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="Who do you want to reach?" /></Field><Field label="Marketing goal"><input value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="e.g. build trust, drive sign-ups" /></Field><Button disabled={busy} className="button-full"><Sparkles size={16} />{busy ? "Finding fresh angles…" : "Find me some ideas"}</Button>{busy && <Spinner label="Thinking up fresh angles…" />}</form><section className="ideas-results">{ideas.length ? <><div className="result-header"><div><span className="eyebrow">TEN WAYS IN</span><h2>Take your pick.</h2></div><button className="icon-button" onClick={() => void generate()} aria-label="Regenerate ideas"><RefreshCw size={17} /></button></div>{ideas.map((idea, index) => <article className="idea-card" key={`${idea}-${index}`}><span className="idea-number">{String(index + 1).padStart(2, "0")}</span><p>{idea}</p><button onClick={() => navigate(`/app/generate?idea=${encodeURIComponent(idea)}`)}>Make this a post <ArrowRight size={14} /></button></article>)}</> : <div className="panel"><EmptyState title="A dozen directions. Well, ten." detail="Tell us a little about your business and we'll put some fresh ideas on the table." /></div>}</section></div>
  </>;
}

export function HashtagsPage() {
  const [form, setForm] = useState({ topic: "", industry: "", platform: "Instagram" });
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setCopied(false);
    try { const { data } = await api.post("/hashtags/generate", form); setHashtags(data.hashtags); }
    catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  };
  return <>
    <PageHeading eyebrow="A LITTLE MORE DISCOVERABLE" title="Hashtag helper" description="Relevant tags, without the endless scroll through search results." />
    {error && <Notice message={error} />}
    <div className="tool-layout"><form className="panel tool-form" onSubmit={(event) => void submit(event)}><div className="form-section-heading"><span>#</span><div><strong>Give us a topic</strong><small>We'll find tags that fit your post and platform.</small></div></div><Field label="Topic"><input required value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="What is your post about?" /></Field><Field label="Industry"><input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="e.g. home baking" /></Field><Field label="Platform"><select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>{platforms.map((item) => <option key={item}>{item}</option>)}</select></Field><Button disabled={busy} className="button-full"><Sparkles size={16} />{busy ? "Finding your tags…" : "Find my hashtags"}</Button></form><section className="panel hashtag-result"><span className="eyebrow">YOUR TAG COLLECTION</span><h2>Just the right tags.</h2>{hashtags.length ? <><div className="hashtag-chips">{hashtags.map((tag) => <span key={tag}>{tag}</span>)}</div><Button variant="secondary" onClick={() => { void navigator.clipboard.writeText(hashtags.join(" ")); setCopied(true); }}><Copy size={15} />{copied ? "Copied!" : "Copy hashtags"}</Button></> : <EmptyState title="The right tags are out there" detail="Add a topic and platform to uncover a set of relevant hashtags." />}</section></div>
  </>;
}

const blankBrand = { name: "", businessName: "", description: "", industry: "", targetAudience: "", website: "", phone: "", email: "", location: "", brandVoice: "", commonCta: "", keywords: "", isDefault: false };
export function BrandsPage() {
  const { data, error, loading, reload } = useLoad<Brand[]>("/brands", "brands");
  const [form, setForm] = useState(blankBrand);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const brands = data ?? [];
  const edit = (brand: Brand) => {
    setEditingId(brand.id);
    setForm({ ...blankBrand, ...brand, businessName: brand.businessName ?? "", description: brand.description ?? "", industry: brand.industry ?? "", targetAudience: brand.targetAudience ?? "", website: brand.website ?? "", phone: brand.phone ?? "", email: brand.email ?? "", location: brand.location ?? "", brandVoice: brand.brandVoice ?? "", commonCta: brand.commonCta ?? "", keywords: brand.keywords ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setFormError(""); setMessage("");
    try {
      if (editingId) await api.put(`/brands/${editingId}`, form);
      else await api.post("/brands", form);
      setForm(blankBrand); setEditingId(""); setMessage("Your brand profile is saved."); await reload();
    } catch (failure) { setFormError(errorText(failure)); }
    finally { setBusy(false); }
  };
  const remove = async (brand: Brand) => {
    if (!window.confirm(`Delete the ${brand.name} brand profile?`)) return;
    try { await api.delete(`/brands/${brand.id}`); await reload(); setMessage("Brand profile deleted."); }
    catch (failure) { setFormError(errorText(failure)); }
  };
  const change = (key: keyof typeof blankBrand, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  return <>
    <PageHeading eyebrow="THE DETAILS THAT MAKE IT YOU" title="Brand kit" description="Set your voice once. Bring it to every post." />
    {error && <Notice message={error} />}{formError && <Notice message={formError} />}{message && <Notice message={message} kind="success" />}
    <div className="brand-page-grid"><form className="panel brand-form" onSubmit={(event) => void submit(event)}><div className="panel-heading"><div><span className="eyebrow">{editingId ? "MAKE A CHANGE" : "NEW BRAND PROFILE"}</span><h2>{editingId ? "Edit your brand" : "Build your brand profile"}</h2></div>{editingId && <button type="button" className="text-link" onClick={() => { setEditingId(""); setForm(blankBrand); }}>Cancel</button>}</div><div className="field-grid two"><Field label="Profile name"><input required value={form.name} onChange={(e) => change("name", e.target.value)} placeholder="e.g. Studio North" /></Field><Field label="Business name"><input value={form.businessName} onChange={(e) => change("businessName", e.target.value)} placeholder="Name customers know" /></Field><Field label="Industry"><input value={form.industry} onChange={(e) => change("industry", e.target.value)} placeholder="e.g. independent retail" /></Field><Field label="Target audience"><input value={form.targetAudience} onChange={(e) => change("targetAudience", e.target.value)} placeholder="Who do you serve?" /></Field><Field label="Website"><input value={form.website} onChange={(e) => change("website", e.target.value)} placeholder="https://" /></Field><Field label="Phone"><input value={form.phone} onChange={(e) => change("phone", e.target.value)} /></Field><Field label="Email"><input type="email" value={form.email} onChange={(e) => change("email", e.target.value)} /></Field><Field label="Location"><input value={form.location} onChange={(e) => change("location", e.target.value)} /></Field></div><Field label="What does your business do?"><textarea rows={3} value={form.description} onChange={(e) => change("description", e.target.value)} placeholder="A sentence or two about your work…" /></Field><Field label="Brand voice"><textarea rows={2} value={form.brandVoice} onChange={(e) => change("brandVoice", e.target.value)} placeholder="e.g. Warm, confident, and never too formal" /></Field><div className="field-grid two"><Field label="Go-to call to action"><input value={form.commonCta} onChange={(e) => change("commonCta", e.target.value)} placeholder="e.g. Come say hello" /></Field><Field label="Brand keywords"><input value={form.keywords} onChange={(e) => change("keywords", e.target.value)} placeholder="A few words to weave in" /></Field></div><label className="checkbox-row"><input type="checkbox" checked={form.isDefault} onChange={(e) => change("isDefault", e.target.checked)} /><span className="custom-check"><Check size={12} /></span><span><strong>Use this as my default brand</strong><small>We'll include it in new content by default.</small></span></label><Button disabled={busy} className="button-full">{busy ? "Saving…" : editingId ? "Save brand changes" : "Save brand profile"}</Button></form><section className="brand-list"><div className="panel-heading"><div><span className="eyebrow">YOUR BRANDS</span><h2>{brands.length} {brands.length === 1 ? "profile" : "profiles"}</h2></div></div>{loading ? <Spinner /> : brands.length ? brands.map((brand) => <article className="brand-card" key={brand.id}><div className="brand-card-icon">{(brand.businessName || brand.name).slice(0, 1).toUpperCase()}</div><div className="brand-card-content"><div className="brand-card-name"><h3>{brand.name}</h3>{brand.isDefault && <span className="default-pill">DEFAULT</span>}</div><p>{brand.industry || "Business profile"}{brand.location ? ` · ${brand.location}` : ""}</p><span className="brand-voice">“{brand.brandVoice || "Add a voice to tailor your content"}”</span><div className="brand-card-actions"><button onClick={() => edit(brand)}>Edit profile</button><button onClick={() => void remove(brand)}><Trash2 size={14} /> Delete</button></div></div></article>) : <EmptyState title="Give your first brand a voice" detail="Create a profile and your content can carry your business details automatically." />}</section></div>
  </>;
}

export function CalendarPage() {
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<CalendarPost | null>(null);
  const [editForm, setEditForm] = useState({ title: "", text: "", scheduledAt: "" });
  const [form, setForm] = useState({ title: "", text: "", platform: "Instagram", scheduledAt: localDateTime(new Date(Date.now() + 86400000)), status: "SCHEDULED" });
  const [month, setMonth] = useState(() => new Date());
  const reload = async () => {
    try {
      const from = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
      const to = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString();
      const { data } = await api.get("/calendar", { params: { from, to } }); setPosts(data.posts);
    } catch (failure) { setError(errorText(failure)); }
  };
  useEffect(() => { void reload(); }, [month]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try { await api.post("/calendar", { ...form, scheduledAt: new Date(form.scheduledAt).toISOString() }); setMessage("Added to your calendar."); setForm((current) => ({ ...current, title: "", text: "" })); await reload(); }
    catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  };
  const updatePost = async (post: CalendarPost, changes: Record<string, unknown>) => {
    try { await api.put(`/calendar/${post.id}`, changes); await reload(); setMessage("Calendar post updated."); return true; }
    catch (failure) { setError(errorText(failure)); return false; }
  };
  const remove = async (post: CalendarPost) => {
    if (!window.confirm("Remove this post from your calendar?")) return;
    try { await api.delete(`/calendar/${post.id}`); await reload(); }
    catch (failure) { setError(errorText(failure)); }
  };
  const beginEdit = (post: CalendarPost) => {
    setEditing(post);
    setEditForm({ title: post.title, text: post.text, scheduledAt: localDateTime(new Date(post.scheduledAt)) });
  };
  const saveCalendarEdit = async () => {
    if (!editing) return;
    if (await updatePost(editing, { ...editForm, scheduledAt: new Date(editForm.scheduledAt).toISOString() })) setEditing(null);
  };
  const calendarCells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start); date.setDate(start.getDate() + index);
      return { date, inMonth: date.getMonth() === month.getMonth(), posts: posts.filter((post) => new Date(post.scheduledAt).toDateString() === date.toDateString()) };
    });
  }, [month, posts]);
  return <>
    <PageHeading eyebrow="A GENTLE PLAN FOR WHAT'S NEXT" title="Content calendar" description="Make a little space for the posts you want to share." />
    {error && <Notice message={error} />}{message && <Notice message={message} kind="success" />}
    <div className="calendar-layout"><section className="panel calendar-panel"><div className="calendar-month"><button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={19} /></button><h2>{month.toLocaleString("en", { month: "long", year: "numeric" })}</h2><button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={19} /></button></div><div className="calendar-grid">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span className="calendar-weekday" key={day}>{day}</span>)}{calendarCells.map(({ date, inMonth, posts: dayPosts }) => <div className={`calendar-cell ${!inMonth ? "outside" : ""} ${date.toDateString() === new Date().toDateString() ? "today" : ""}`} key={date.toISOString()}><span>{date.getDate()}</span>{dayPosts.slice(0, 2).map((post) => <button className={`calendar-event ${post.status.toLowerCase()}`} key={post.id} title={post.title} onClick={() => void updatePost(post, { status: post.status === "PUBLISHED" ? "SCHEDULED" : "PUBLISHED" })}>{post.title}</button>)}{dayPosts.length > 2 && <small>+{dayPosts.length - 2} more</small>}</div>)}</div><div className="calendar-legend"><span><i className="event-dot scheduled" /> Scheduled</span><span><i className="event-dot published" /> Published</span><small>Click an event to toggle its published status.</small></div></section><form className="panel calendar-form" onSubmit={(event) => void submit(event)}><span className="eyebrow">ADD TO THE PLAN</span><h2>Make a date.</h2><Field label="Post title"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="A little title for your post" /></Field><Field label="Your post"><textarea required rows={5} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Write your post or paste a saved draft…" /></Field><Field label="Platform"><select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>{platforms.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Date and time"><input type="datetime-local" required value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></Field><Button disabled={busy} className="button-full"><CalendarDays size={16} />{busy ? "Adding…" : "Add to calendar"}</Button></form></div>
    <section className="panel upcoming-panel"><div className="panel-heading"><div><span className="eyebrow">ON THE HORIZON</span><h2>Posts this month</h2></div></div>{posts.length ? <div className="upcoming-list">{posts.map((post) => <article className="upcoming-row" key={post.id}><div className="upcoming-date"><strong>{new Date(post.scheduledAt).getDate()}</strong><span>{new Date(post.scheduledAt).toLocaleString("en", { month: "short" })}</span></div><div className="upcoming-main"><strong>{post.title}</strong><p>{post.text}</p></div><span className={`status-pill ${post.status.toLowerCase()}`}>{post.status.toLowerCase()}</span><input className="calendar-date-edit" aria-label={`Reschedule ${post.title}`} type="datetime-local" defaultValue={localDateTime(new Date(post.scheduledAt))} onBlur={(event) => { if (event.currentTarget.value && new Date(event.currentTarget.value).getTime() !== new Date(post.scheduledAt).getTime()) void updatePost(post, { scheduledAt: new Date(event.currentTarget.value).toISOString() }); }} /><select aria-label="Update status" value={post.status} onChange={(e) => void updatePost(post, { status: e.target.value })}><option value="DRAFT">Draft</option><option value="SCHEDULED">Scheduled</option><option value="PUBLISHED">Published</option></select><button className="icon-button" onClick={() => beginEdit(post)} aria-label="Edit calendar post"><Pencil size={15} /></button><button className="icon-button delete-action" onClick={() => void remove(post)} aria-label="Delete calendar post"><Trash2 size={16} /></button></article>)}</div> : <EmptyState title="A little room on the calendar" detail="Add your first post above, or schedule one from the generator." action={<Link to="/app/generate" className="button secondary">Create a post <ArrowRight size={14} /></Link>} />}</section>
    {editing && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><div className="modal-card"><div className="modal-heading"><div><span className="eyebrow">EDIT SCHEDULED POST</span><h2>Adjust the plan.</h2></div><button className="icon-button" onClick={() => setEditing(null)} aria-label="Close edit dialog"><X size={18} /></button></div><div className="form-stack"><Field label="Post title"><input value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} /></Field><Field label="Post text"><textarea rows={8} value={editForm.text} onChange={(event) => setEditForm({ ...editForm, text: event.target.value })} /></Field><Field label="Date and time"><input type="datetime-local" value={editForm.scheduledAt} onChange={(event) => setEditForm({ ...editForm, scheduledAt: event.target.value })} /></Field></div><div className="modal-actions"><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={() => void saveCalendarEdit()}><Save size={15} /> Save changes</Button></div></div></div>}
  </>;
}

function BarList({ title, rows }: { title: string; rows: Array<{ name: string; count: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return <section className="panel bar-list"><div className="panel-heading"><div><span className="eyebrow">A CLOSER LOOK</span><h2>{title}</h2></div></div>{rows.length ? rows.map((row) => <div className="metric-bar-row" key={row.name}><div><span>{row.name}</span><strong>{row.count}</strong></div><div className="metric-track"><span style={{ width: `${(row.count / max) * 100}%` }} /></div></div>) : <div className="small-empty">As you create, your breakdown will appear here.</div>}</section>;
}
export function AnalyticsPage() {
  const { data, error, loading } = useLoad<Analytics>("/analytics", "analytics");
  return <>
    <PageHeading eyebrow="THE SHAPE OF YOUR STORY" title="Analytics" description="A simple look at what you're creating and where it's going." />
    {error && <Notice message={error} />}
    {loading ? <Spinner /> : data && <><div className="stats-grid"><StatCard label="Posts generated" value={data.generatedThisMonth} note="This month" icon="✳" /><StatCard label="Posts saved" value={data.savedPosts} note="In your library" icon="▤" tint="lavender" /><StatCard label="Favorites" value={data.favoritePosts} note="Your go-to posts" icon="♡" tint="peach" /><StatCard label="AI generations" value={data.aiUsage} note="This month" icon="✦" tint="yellow" /></div><div className="analytics-grid"><BarList title="By platform" rows={data.byPlatform} /><BarList title="By content type" rows={data.byContentType} /></div><section className="panel activity-panel analytics-activity"><div className="panel-heading"><div><span className="eyebrow">A STEADY RHYTHM</span><h2>Monthly activity</h2></div><span className="chart-period">Last 6 months</span></div><div className="bar-chart tall">{data.monthlyActivity.map((item) => <div className="bar-column" key={item.month}><div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(item.count * 12, item.count ? 16 : 4)}%` }} /><small>{item.count}</small></div><span>{item.month}</span></div>)}</div></section></>}
  </>;
}

const planOptions = [
  { name: "FREE", price: "$0", description: "A calm start for your content journey.", generations: "5 AI generations / month", details: ["10 saved posts", "Basic templates", "1 brand profile"] },
  { name: "CREATOR", price: "Coming soon", description: "For people who post with purpose.", generations: "100 AI generations / month", details: ["Unlimited saved posts", "All templates", "Brand kit + calendar", "Hashtag helper"] },
  { name: "BUSINESS", price: "Coming soon", description: "For growing teams and busy brands.", generations: "500 AI generations / month", details: ["Unlimited content", "Multiple brand profiles", "Advanced AI tools", "Business analytics"] },
  { name: "AGENCY", price: "Let's talk", description: "Room for clients, collaboration, and more.", generations: "Large fair-use allowance", details: ["Multiple client brands", "Advanced analytics", "Team and client workspaces (coming soon)"] },
];
export function SubscriptionPage() {
  const [subscription, setSubscription] = useState<{ plan: string; usage: { generations: number }; limits: { generations: number }; billingEnabled: boolean } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void api.get("/subscription").then(({ data }) => setSubscription(data.subscription)).catch((failure) => setError(errorText(failure))); }, []);
  return <>
    <PageHeading eyebrow="ROOM TO GROW, YOUR WAY" title="Plans & usage" description="A clear view of your plan, with room to find your next one." />
    {error && <Notice message={error} />}
    {subscription && <><div className="panel usage-panel"><div><span className="eyebrow">YOUR CURRENT PLAN</span><h2>{subscription.plan} <span className="status-pill scheduled">ACTIVE</span></h2><p>{subscription.usage.generations} of {subscription.limits.generations} AI generations used this month</p></div><div className="usage-meter"><span style={{ width: `${Math.min(100, subscription.usage.generations / subscription.limits.generations * 100)}%` }} /></div></div><div className="plan-grid">{planOptions.map((plan) => <article className={`plan-card ${subscription.plan === plan.name ? "current" : ""}`} key={plan.name}><div className="plan-card-heading"><h3>{plan.name}</h3>{subscription.plan === plan.name && <span className="default-pill">CURRENT PLAN</span>}</div><p>{plan.description}</p><div className="plan-card-price">{plan.price}</div><strong className="plan-generation">{plan.generations}</strong><ul>{plan.details.map((detail) => <li key={detail}><Check size={15} />{detail}</li>)}</ul>{plan.name === "FREE" ? <span className="plan-current-action">Your starting plan</span> : <a className={`button ${plan.name === "CREATOR" ? "primary" : "secondary"} button-full`} href="mailto:hello@postpilot.ai?subject=PostPilot%20plan%20enquiry">Ask about {plan.name.toLowerCase()} <ArrowRight size={14} /></a>}</article>)}</div><p className="billing-note">Plan upgrades are not processed in this MVP. Paid-plan billing and checkout need a payment provider integration. Business/agency team workspaces and advanced analytics are also planned, not active. Features and usage limits are enforced by the backend.</p></>}
  </>;
}

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [aiStatus, setAiStatus] = useState<{
    configured: boolean; provider: string; model: string; error: string | null;
    source: "account" | "server" | "missing"; canConfigure: boolean;
    hasAccountConnection: boolean;
    accountConnection: { provider: "OPENAI" | "OPENAI_COMPATIBLE"; baseUrl: string | null; model: string } | null;
  } | null>(null);
  const [aiProvider, setAiProvider] = useState<"OPENAI" | "OPENAI_COMPATIBLE">("OPENAI");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState("gpt-4o-mini");
  const [aiBaseUrl, setAiBaseUrl] = useState("https://api.openai.com/v1");
  const [aiSaveBusy, setAiSaveBusy] = useState(false);
  const [aiSaveMessage, setAiSaveMessage] = useState("");
  const [aiSaveError, setAiSaveError] = useState("");
  const [aiRemoveBusy, setAiRemoveBusy] = useState(false);
  const [aiStatusError, setAiStatusError] = useState("");
  const [aiTestBusy, setAiTestBusy] = useState(false);
  const [aiTestMessage, setAiTestMessage] = useState("");
  const [aiTestError, setAiTestError] = useState("");
  const [researchConfigured, setResearchConfigured] = useState(false);
  const [researchCanConfigure, setResearchCanConfigure] = useState(false);
  const [researchApiKey, setResearchApiKey] = useState("");
  const [researchBusy, setResearchBusy] = useState(false);
  const [researchMessage, setResearchMessage] = useState("");
  const [researchError, setResearchError] = useState("");
  const [researchTestBusy, setResearchTestBusy] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const loadAiStatus = async () => {
    setAiStatusError("");
    try {
      const { data } = await api.get("/ai/status");
      setAiStatus(data.ai);
      if (data.ai.accountConnection) {
        setAiProvider(data.ai.accountConnection.provider);
        setAiModel(data.ai.accountConnection.model);
        setAiBaseUrl(data.ai.accountConnection.baseUrl || "https://api.openai.com/v1");
      }
    } catch (failure) {
      setAiStatusError(errorText(failure));
    }
  };
  const loadResearchStatus = async () => {
    try {
      const { data } = await api.get("/ai/research-connection");
      setResearchConfigured(Boolean(data.research.configured));
      setResearchCanConfigure(Boolean(data.research.canConfigure));
    } catch (failure) {
      setResearchError(errorText(failure));
    }
  };
  useEffect(() => { void loadAiStatus(); void loadResearchStatus(); }, []);
  const testAi = async () => {
    setAiTestBusy(true);
    setAiTestMessage("");
    setAiTestError("");
    try {
      const { data } = await api.post("/ai/test");
      setAiTestMessage(`${data.message} ${data.provider} · ${data.model} · ${data.latencyMs} ms.`);
      await loadAiStatus();
    } catch (failure) {
      setAiTestError(errorText(failure));
    } finally {
      setAiTestBusy(false);
    }
  };
  const saveAiConnection = async (event: FormEvent) => {
    event.preventDefault();
    setAiSaveBusy(true);
    setAiSaveError("");
    setAiSaveMessage("");
    try {
      const { data } = await api.put("/ai/connection", {
        provider: aiProvider,
        apiKey: aiApiKey || undefined,
        model: aiModel,
        ...(aiProvider === "OPENAI_COMPATIBLE" ? { baseUrl: aiBaseUrl } : {}),
      });
      setAiApiKey("");
      setAiSaveMessage(data.message);
      await loadAiStatus();
    } catch (failure) {
      setAiSaveError(errorText(failure));
    } finally {
      setAiSaveBusy(false);
    }
  };
  const removeAiConnection = async () => {
    setAiRemoveBusy(true);
    setAiSaveError("");
    setAiSaveMessage("");
    try {
      const { data } = await api.delete("/ai/connection");
      setAiApiKey("");
      setAiSaveMessage(data.message);
      await loadAiStatus();
    } catch (failure) {
      setAiSaveError(errorText(failure));
    } finally {
      setAiRemoveBusy(false);
    }
  };
  const saveResearchConnection = async (event: FormEvent) => {
    event.preventDefault();
    setResearchBusy(true);
    setResearchError("");
    setResearchMessage("");
    try {
      const { data } = await api.put("/ai/research-connection", { apiKey: researchApiKey || undefined });
      setResearchApiKey("");
      setResearchMessage(data.message);
      await loadResearchStatus();
    } catch (failure) {
      setResearchError(errorText(failure));
    } finally {
      setResearchBusy(false);
    }
  };
  const testResearch = async () => {
    setResearchTestBusy(true);
    setResearchError("");
    setResearchMessage("");
    try {
      const { data } = await api.post("/ai/research-test");
      setResearchMessage(`${data.message} ${data.sourceCount} sources verified with ${data.searchDepth} search.`);
    } catch (failure) {
      setResearchError(errorText(failure));
    } finally {
      setResearchTestBusy(false);
    }
  };
  const removeResearchConnection = async () => {
    setResearchBusy(true);
    setResearchError("");
    setResearchMessage("");
    try {
      const { data } = await api.delete("/ai/research-connection");
      setResearchApiKey("");
      setResearchMessage(data.message);
      await loadResearchStatus();
    } catch (failure) {
      setResearchError(errorText(failure));
    } finally {
      setResearchBusy(false);
    }
  };
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try { await api.put("/user/profile", { name }); await refreshUser(); setMessage("Profile details updated."); }
    catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  };
  const changePassword = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try { await api.put("/auth/password", { currentPassword, newPassword }); setCurrentPassword(""); setNewPassword(""); setMessage("Password updated."); }
    catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  };
  return <>
    <PageHeading eyebrow="THE LITTLE DETAILS" title="Settings" description="Your account, your way." />
    {error && <Notice message={error} />}{message && <Notice message={message} kind="success" />}
    <div className="settings-grid">
      <form className="panel settings-card" onSubmit={(event) => void saveProfile(event)}>
        <span className="eyebrow">YOUR ACCOUNT</span><h2>Profile details</h2>
        <Field label="Name"><input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email address"><input value={user?.email ?? ""} disabled /></Field>
        <Button disabled={busy}>Save profile</Button>
      </form>
      <form className="panel settings-card" onSubmit={(event) => void changePassword(event)}>
        <span className="eyebrow">KEEP IT SECURE</span><h2>Change password</h2>
        <Field label="Current password"><input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></Field>
        <Field label="New password"><input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></Field>
        <Button variant="secondary" disabled={busy}>Update password</Button>
      </form>
      <section className="panel settings-card ai-settings-card">
        <span className="eyebrow">PRIVATE AI CONNECTION</span>
        <div className="ai-settings-title">
          <h2>Connect an AI provider</h2>
          {aiStatus && <span className={`ai-connection-pill ${aiStatus.configured ? "ready" : "missing"}`}><i />{aiStatus.configured ? "CONNECTED" : "NOT CONNECTED"}</span>}
        </div>
        {aiStatusError && <Notice message={aiStatusError} />}
        {aiStatus && <>
          <p>{aiStatus.source === "account"
            ? `Your account is connected to ${aiStatus.provider} using ${aiStatus.model}. API keys are encrypted on the server and are never shown again.`
            : aiStatus.source === "server"
              ? `Using the server's shared ${aiStatus.provider} connection (${aiStatus.model}). Add a private connection below to use your own provider account.`
              : "Connect your own provider account to use AI writing, content ideas, hashtag suggestions, and editing tools."}</p>
          {!aiStatus.canConfigure && <div className="ai-config-guidance">
            <strong>One-time server setup required</strong>
            <span>Add <code>AI_CREDENTIALS_SECRET</code> to the project-root <code>.env</code> before storing provider keys. Generate one with <code>node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"</code>, then restart the backend.</span>
          </div>}
          {aiStatus.error && aiStatus.source !== "missing" && <Notice message={aiStatus.error} />}
          <form className="ai-connection-form" onSubmit={(event) => void saveAiConnection(event)}>
            <div className="field-grid two">
              <Field label="Provider">
                <select value={aiProvider} onChange={(event) => {
                  const provider = event.target.value as "OPENAI" | "OPENAI_COMPATIBLE";
                  setAiProvider(provider);
                  if (provider === "OPENAI") {
                    setAiModel("gpt-4o-mini");
                    setAiBaseUrl("https://api.openai.com/v1");
                  } else {
                    setAiModel("");
                    setAiBaseUrl("");
                  }
                }}>
                  <option value="OPENAI">OpenAI</option>
                  <option value="OPENAI_COMPATIBLE">OpenAI-compatible provider</option>
                </select>
              </Field>
              <Field label="Model">
                <input required value={aiModel} onChange={(event) => setAiModel(event.target.value)} placeholder={aiProvider === "OPENAI" ? "gpt-4o-mini" : "Provider model ID"} />
              </Field>
            </div>
            {aiProvider === "OPENAI_COMPATIBLE" && <Field label="API base URL" hint="Use the provider API base URL; the site appends /chat/completions.">
              <input required type="url" value={aiBaseUrl} onChange={(event) => setAiBaseUrl(event.target.value)} placeholder="https://api.provider.com/v1" />
            </Field>}
            <Field label={aiStatus.hasAccountConnection ? "Replace API key (optional)" : "API key"} hint={aiStatus.hasAccountConnection ? "Leave blank to keep the encrypted key already saved." : "Your key is sent only to this server and encrypted before storage."}>
              <input
                required={!aiStatus.hasAccountConnection}
                type="password"
                autoComplete="new-password"
                value={aiApiKey}
                onChange={(event) => setAiApiKey(event.target.value)}
                placeholder={aiStatus.hasAccountConnection ? "Saved securely — enter only to replace" : "Paste your provider API key"}
              />
            </Field>
            {aiSaveError && <Notice message={aiSaveError} />}
            {aiSaveMessage && <Notice kind="success" message={aiSaveMessage} />}
            <div className="ai-settings-actions">
              <Button disabled={aiSaveBusy || !aiStatus.canConfigure}>{aiSaveBusy ? "Saving securely…" : aiStatus.hasAccountConnection ? "Update connection" : "Save connection"}</Button>
              {aiStatus.configured && <Button type="button" variant="secondary" disabled={aiTestBusy} onClick={() => void testAi()}>{aiTestBusy ? "Testing…" : "Test connection"}</Button>}
              <Button type="button" variant="quiet" onClick={() => void loadAiStatus()}>Refresh</Button>
              {aiStatus.hasAccountConnection && <Button type="button" variant="danger" disabled={aiRemoveBusy} onClick={() => void removeAiConnection()}>{aiRemoveBusy ? "Removing…" : "Remove connection"}</Button>}
            </div>
            {aiTestMessage && <Notice kind="success" message={aiTestMessage} />}
            {aiTestError && <Notice message={aiTestError} />}
          </form>
        </>}
        {!aiStatus && !aiStatusError && <Spinner label="Checking AI configuration…" />}
      </section>
      <section className="panel settings-card ai-settings-card research-settings-card">
        <span className="eyebrow">SOURCE-GROUNDED WRITING</span>
        <div className="ai-settings-title">
          <h2>Deep research connection</h2>
          <span className={`ai-connection-pill ${researchConfigured ? "ready" : "missing"}`}><i />{researchConfigured ? "TAVILY CONNECTED" : "NOT CONNECTED"}</span>
        </div>
        <p>Connect Tavily Search to gather current web sources before writing. The generated post stays citation-free; source links and excerpts are shown separately for review.</p>
        <div className="research-privacy-note">
          The topic description, brand industry, and campaign goal are sent to Tavily when you enable research. Audience, contact information, prices, and private brand details are not sent. Advanced search may use 2 Tavily API credits per research run.
        </div>
        {!researchCanConfigure && <div className="ai-config-guidance">
          <strong>One-time server setup required</strong>
          <span>Set <code>AI_CREDENTIALS_SECRET</code> in the project-root <code>.env</code> before saving a search key. The same stable 64-character key used for AI provider credentials encrypts this value.</span>
        </div>}
        <form className="ai-connection-form" onSubmit={(event) => void saveResearchConnection(event)}>
          <Field label={researchConfigured ? "Replace Tavily API key (optional)" : "Tavily API key"} hint={researchConfigured
            ? "Leave blank to retain the encrypted key."
            : "It is encrypted before storage and never returned."}>
            <input
              type="password"
              autoComplete="new-password"
              required={!researchConfigured}
              value={researchApiKey}
              onChange={(event) => setResearchApiKey(event.target.value)}
              placeholder={researchConfigured ? "Saved securely — enter only to replace" : "Paste your Tavily API key"}
            />
          </Field>
          {!researchConfigured && <a className="research-signup-link" href="https://app.tavily.com/" target="_blank" rel="noopener noreferrer">Get an API key from Tavily <ArrowRight size={12} /></a>}
          {researchError && <Notice message={researchError} />}
          {researchMessage && <Notice kind="success" message={researchMessage} />}
          <div className="ai-settings-actions">
            <Button disabled={researchBusy || !researchCanConfigure}>{researchBusy ? "Saving securely…" : researchConfigured ? "Update research key" : "Save research key"}</Button>
            {researchConfigured && <>
              <Button type="button" variant="secondary" disabled={researchTestBusy} onClick={() => void testResearch()}>{researchTestBusy ? "Testing…" : "Test search"}</Button>
              <Button type="button" variant="danger" disabled={researchBusy} onClick={() => void removeResearchConnection()}>{researchBusy ? "Removing…" : "Remove key"}</Button>
            </>}
            <Button type="button" variant="quiet" onClick={() => void loadResearchStatus()}>Refresh</Button>
          </div>
        </form>
      </section>
      <div className="panel settings-card">
        <span className="eyebrow">YOUR WORKSPACE</span><h2>One place for your brand</h2>
        <p>Your brand profile informs the voice and details in the content you generate.</p>
        <Link to="/app/brands" className="text-link">Manage your brand kit <ArrowRight size={15} /></Link>
      </div>
    </div>
  </>;
}
