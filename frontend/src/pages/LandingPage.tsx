import { ArrowDown, ArrowRight, Check, Command, Menu, Play, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

const features = [
  { number: "01", title: "Your voice, everywhere", text: "Create on-brand captions for Instagram, LinkedIn, Facebook, TikTok, and X in one calm workspace.", icon: "✳" },
  { number: "02", title: "A little help, a lot of momentum", text: "Turn a rough idea into polished copy, fresh angles, and platform-ready hashtags.", icon: "↗" },
  { number: "03", title: "Never lose a good idea", text: "Save the good ones, plan what's next, and keep your content calendar moving.", icon: "◷" },
];
const plans = [
  { title: "Free", price: "Free", detail: "A lovely place to start.", features: ["5 AI generations / month", "10 saved posts", "Basic templates", "1 brand profile"] },
  { title: "Creator", price: "Coming soon", detail: "For people who post with purpose.", features: ["100 AI generations / month", "Unlimited saved posts", "All templates", "Brand kit + calendar"], featured: true },
  { title: "Business", price: "Coming soon", detail: "Your whole brand, in sync.", features: ["500 AI generations / month", "Multiple brand profiles", "Advanced AI tools", "Analytics + team-ready"] },
  { title: "Agency", price: "Let's talk", detail: "For teams looking after many brands.", features: ["Large fair-use allowance", "Multiple client brands", "Team-ready workspaces", "Advanced analytics"] },
];

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return <div className="landing">
    <header className="landing-nav">
      <Link to="/" className="brand-lockup"><span className="brand-symbol"><Command size={18} /></span>postpilot<span className="brand-ai">.ai</span></Link>
      <nav><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#pricing">Pricing</a></nav>
      <div className="landing-actions"><Link className="nav-login" to="/login">Log in</Link><Link className="button primary" to="/register">Try it free <ArrowRight size={16} /></Link></div>
      <button className="landing-menu" aria-label={mobileMenuOpen ? "Close menu" : "Open menu"} onClick={() => setMobileMenuOpen((open) => !open)}><Menu size={20} /></button>
      {mobileMenuOpen && <nav className="landing-mobile-menu"><a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a><a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How it works</a><a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a><a href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a><Link to="/login" onClick={() => setMobileMenuOpen(false)}>Log in</Link><Link to="/register" onClick={() => setMobileMenuOpen(false)}>Try it free <ArrowRight size={14} /></Link></nav>}
    </header>
    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-kicker"><span /> THE LITTLE TOOL WITH BIG IDEAS</div>
          <h1>Good things<br />to <em>say.</em><br /><span>Every day.</span></h1>
          <p className="hero-description">Social content that sounds like you, looks like you, and actually gets out the door. Meet your new creative co-pilot.</p>
          <div className="hero-buttons"><Link to="/register" className="button primary button-large">Make something good <ArrowRight size={17} /></Link><a className="watch-link" href="#how-it-works"><span><Play size={14} fill="currentColor" /></span> See how it works</a></div>
          <div className="hero-note"><div className="avatar-stack"><i>A</i><i>M</i><i>J</i></div><span>Made for the people behind the posts</span></div>
        </div>
        <div className="hero-visual">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="decor-leaf">✳</div>
          <div className="draft-card">
            <div className="draft-top"><span className="draft-label"><Sparkles size={13} /> A FRESH DRAFT</span><span className="draft-dots">•••</span></div>
            <div className="draft-platform"><span className="platform-dot instagram-dot">◎</span> Instagram <span className="draft-time">just now</span></div>
            <div className="draft-body"><div className="draft-title">A slower morning.<br />A better cup. ☕</div><p>Some things are worth taking your time over. Our new seasonal roast is one of them — grown with care, roasted close to home, and ready for your favorite mug.</p><p>Come find your new morning ritual. We’ll save you a seat. 🌿</p><div className="hashtags">#slowmornings #coffeepeople #madeforhere</div></div>
            <div className="draft-footer"><span>✦ &nbsp; On-brand, just like that</span><div><span>♡</span><span>↗</span></div></div>
          </div>
          <div className="floating-note"><span>✦</span><div><strong>Sounds like you</strong><small>Your brand voice, remembered</small></div></div>
          <div className="floating-number"><span>✧</span><strong>One idea.</strong><small>So many good directions.</small></div>
        </div>
        <a className="scroll-cue" href="#features"><ArrowDown size={15} /> A little more</a>
      </section>
      <section className="social-proof"><span>MADE FOR THE PEOPLE WHO MAKE THINGS HAPPEN</span><div><strong>INDIE BRANDS</strong><strong>SMALL TEAMS</strong><strong>BIG IDEAS</strong><strong>GOOD BUSINESSES</strong></div></section>
      <section className="section features-section" id="features">
        <div className="section-heading"><span className="eyebrow">A CLEARER KIND OF CONTENT TOOL</span><h2>Less “what should I post?”<br /><em>More “that’s the one.”</em></h2><p>All the right tools to get from a spark to something worth sharing.</p></div>
        <div className="feature-grid">{features.map((feature) => <article className="feature-card" key={feature.number}><div className="feature-card-top"><span>{feature.number}</span><b>{feature.icon}</b></div><h3>{feature.title}</h3><p>{feature.text}</p><a href="#how-it-works">Explore the details <ArrowRight size={14} /></a></article>)}</div>
      </section>
      <section className="workflow-section" id="how-it-works"><div className="workflow-text"><span className="eyebrow">GOOD WORK, WITHOUT THE BUSYWORK</span><h2>From “hmm…”<br />to <em>“here it is.”</em></h2><p>No complicated setup. No mysterious prompts. Just you, a little direction, and a post that feels ready to go.</p><Link to="/register" className="text-link">Give it a go <ArrowRight size={16} /></Link></div><div className="workflow-steps"><div className="workflow-step"><span>01</span><div><strong>Tell us the gist</strong><p>A product, an announcement, that half-formed idea in your notes.</p></div><b>↗</b></div><div className="workflow-step"><span>02</span><div><strong>Make it sound like you</strong><p>Pick your platform, tone, and the brand details that matter.</p></div><b>✳</b></div><div className="workflow-step"><span>03</span><div><strong>Find the words</strong><p>Get a thoughtful first draft, then edit, save, and share it on your terms.</p></div><b>↗</b></div></div></section>
      <section className="section pricing-section" id="pricing"><div className="section-heading"><span className="eyebrow">ROOM TO GROW, YOUR WAY</span><h2>Start small.<br /><em>Make a little noise.</em></h2><p>Try the essentials free. Find your rhythm, then choose what fits.</p></div><div className="pricing-grid">{plans.map((plan) => <article key={plan.title} className={`pricing-card ${plan.featured ? "featured" : ""}`}>{plan.featured && <div className="plan-ribbon">A LITTLE MORE ROOM</div>}<div className="plan-top"><h3>{plan.title}</h3><p>{plan.detail}</p></div><div className="plan-price">{plan.price}</div><ul>{plan.features.map((item) => <li key={item}><Check size={16} />{item}</li>)}</ul><Link className={`button ${plan.featured ? "primary" : "secondary"} button-full`} to="/register">{plan.title === "Agency" ? "Get started" : `Start with ${plan.title}`}</Link><small>{plan.title === "Free" ? "No card needed to get started." : "Paid billing isn't active in this MVP."}</small></article>)}</div><p className="billing-note">Paid plan prices and checkout are not enabled in this MVP. Free plan limits are enforced by the API.</p></section>
      <section className="faq-section" id="faq"><div className="section-heading"><span className="eyebrow">A FEW GOOD QUESTIONS</span><h2>The useful <em>details.</em></h2><p>Everything you need to know before your first draft.</p></div><div className="faq-list"><details><summary>Does PostPilot publish directly to social platforms?</summary><p>No. This MVP helps you create, edit, save, and plan posts. You choose when and where to publish.</p></details><details><summary>Can I make the drafts sound like my brand?</summary><p>Yes. Add your business details, audience, keywords, and voice to a Brand Kit profile. The backend includes it in AI requests when you select that profile.</p></details><details><summary>Do I need an AI provider key?</summary><p>Yes, for AI generation. Configure the provider key on the server; it is never sent to the browser. Other workspace features use your database-backed content.</p></details><details><summary>Are paid subscriptions available?</summary><p>Plan limits are enforced, but billing and checkout are not enabled yet. The Free plan is available for local and MVP use.</p></details></div></section>
      <section className="closing-cta"><span className="eyebrow">YOUR NEXT POST IS CLOSER THAN YOU THINK</span><h2>A good idea deserves<br />a <em>good way out.</em></h2><Link to="/register" className="button primary button-large">Let’s make something <ArrowRight size={17} /></Link><div className="cta-spark cta-spark-one">✳</div><div className="cta-spark cta-spark-two">✧</div></section>
    </main>
    <footer className="landing-footer"><Link to="/" className="brand-lockup"><span className="brand-symbol"><Command size={18} /></span>postpilot<span className="brand-ai">.ai</span></Link><span>Thoughtful content, made easier.</span><div><a href="#features">Features</a><a href="#pricing">Pricing</a><Link to="/login">Sign in</Link></div><small>© 2026 PostPilot AI</small></footer>
  </div>;
}
