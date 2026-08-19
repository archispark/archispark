import Image from "next/image"
import Link from "next/link"
import { ContactForm } from "@/components/contact-form"

const features = [
  [
    "⌘",
    "AI-Native via MCP",
    "Let an MCP agent create, query and manage your models in natural language.",
  ],
  [
    "↔",
    "AOEF interoperability",
    "Import and export models with Archi, BiZZdesign and Sparx EA.",
  ],
  [
    "◈",
    "Interactive canvas",
    "Drag, resize and connect ArchiMate elements in the browser.",
  ],
  [
    "✓",
    "Relationship validation",
    "Check relationships against ArchiMate 3.1 rules as you model.",
  ],
  [
    "⚙",
    "Role-based access",
    "Organizations and members keep every workspace properly scoped.",
  ],
  [
    "🗺",
    "Analytical landscapes",
    "Explore your architecture through configurable dashboards and views.",
  ],
  ["⊞", "Multi-workspace", "Manage multiple ArchiMate models side by side."],
  [
    "◧",
    "ArchiMate notation",
    "Render element types with their layer-specific colours and icons.",
  ],
  [
    "⚡",
    "SVG and PNG export",
    "Export individual views or the full model whenever you need it.",
  ],
  [
    "🔍",
    "Powerful filtering",
    "Filter elements and relationships by type, name, source or target.",
  ],
  [
    "🌐",
    "Multilingual UI",
    "Switch the interface language instantly and keep your preference.",
  ],
  [
    "🗄",
    "PostgreSQL persistence",
    "Store models and metadata in PostgreSQL with managed migrations.",
  ],
]

const screenshots = [
  [
    "overview.png",
    "Dashboard",
    "At-a-glance model statistics by ArchiMate layer",
    true,
  ],
  [
    "canvas.png",
    "Interactive canvas",
    "Drag, connect and resize your model",
    false,
  ],
  ["views.png", "Views library", "Browse and export every diagram", false],
  [
    "relationships.png",
    "Relationship validator",
    "Conflicts highlighted with suggested alternatives",
    true,
  ],
  ["elements.png", "Element catalog", "Filter and edit every element", false],
  [
    "organizations.png",
    "Organizations",
    "Manage members and roles per organization",
    false,
  ],
] as const

export default function HomePage() {
  return (
    <main id="top" className="landing">
      <nav className="landing-nav" aria-label="Main navigation">
        <Link href="/" className="landing-logo">
          <Image src="/logo.svg" alt="" width={28} height={28} priority />
          <span>
            Archi<span>Spark</span>
          </span>
        </Link>
        <div className="landing-nav-links">
          <a href="#screenshots">Screenshots</a>
          <a href="#features">Features</a>
          <a href="#mcp">MCP</a>
          <a href="#contact">Contact</a>
        </div>
        <a className="landing-demo" href="https://demo.archispark.cloud/">
          Demo Archispark
        </a>
      </nav>

      <section className="landing-hero">
        <h1>
          Model enterprise architecture.
          <br />
          <em>Query it with AI.</em>
        </h1>
        <p>
          ArchiSpark combines a web UI, REST API and MCP server to model,
          explore and manage ArchiMate 3.1 architecture.
        </p>
        <div className="landing-actions">
          <Link className="landing-primary" href="/docs">
            Read the docs →
          </Link>
          <a
            className="landing-secondary"
            href="https://github.com/Archimatetool/archispark"
          >
            View on GitHub
          </a>
        </div>
        <div className="landing-stats">
          <span>ArchiMate 3.1</span>
          <span>REST API</span>
          <span>MCP tools</span>
          <span>PostgreSQL</span>
          <span>AOEF import/export</span>
          <span>Organization RBAC</span>
        </div>
      </section>

      <section id="screenshots" className="landing-section">
        <p className="landing-eyebrow">Screenshots</p>
        <h2>See it in action.</h2>
        <p className="landing-intro">
          Interactive canvas, validation and analytical landscapes built in.
        </p>
        <div className="landing-screenshots">
          {screenshots.map(([file, title, description, wide]) => (
            <figure
              key={file}
              className={
                wide ? "landing-shot landing-shot-wide" : "landing-shot"
              }
            >
              <img src={`/screenshots/${file}`} alt={title} />
              <figcaption>
                <strong>{title}</strong>
                <span>{description}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section id="features" className="landing-section">
        <p className="landing-eyebrow">Features</p>
        <h2>Built for architects who ship.</h2>
        <p className="landing-intro">
          Everything your team needs to make enterprise architecture a living,
          queryable practice.
        </p>
        <div className="landing-features">
          {features.map(([icon, title, description]) => (
            <article key={title}>
              <span className="landing-feature-icon" aria-hidden="true">
                {icon}
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="mcp" className="landing-section landing-mcp-section">
        <div className="landing-mcp-heading">
          <p className="landing-eyebrow">MCP server</p>
          <h2>Let AI build your architecture.</h2>
        </div>
        <div className="landing-mcp">
          <div className="landing-mcp-content">
            <p>
              ArchiSpark ships a Streamable HTTP MCP server exposing 37 tools —
              full API parity. Point Claude at it and describe your systems — it
              creates elements, relationships, views and renders diagrams, all
              through natural language.
            </p>
            <ul className="landing-mcp-tools">
              <li>
                Create, update and delete elements, relationships and views
              </li>
              <li>Query elements by type, layer or name</li>
              <li>Render any view as SVG</li>
              <li>Import and export AOEF XML</li>
              <li>Manage property definitions and workspaces</li>
              <li>Secure Bearer token authentication</li>
            </ul>
            <Link
              className="landing-primary"
              href="/docs/developer-guide/reference/mcp-tools"
            >
              Explore MCP tools →
            </Link>
          </div>
          <pre>{`# Claude Code
claude mcp add archispark \\
  http://localhost:8000/mcp/ \\
  --transport http \\
  --header "Authorization: Bearer <your-token>"

# Codex
export ARCHISPARK_TOKEN="<your-token>"
codex mcp add archispark \\
  --url http://localhost:8000/mcp/ \\
  --bearer-token-env-var ARCHISPARK_TOKEN

# Then ask Codex:
Create a BusinessActor "Customer",
an ApplicationComponent "CRM",
and a Serving relationship.`}</pre>
        </div>
      </section>

      <section id="quickstart" className="landing-section landing-quickstart">
        <p className="landing-eyebrow">Quick start</p>
        <h2>Up and running in minutes.</h2>
        <p className="landing-intro">
          Three steps. Then open the web UI and start modelling.
        </p>
        <div className="landing-steps">
          <article>
            <span>1</span>
            <h3>Clone and install</h3>
            <p>Requires Node.js 22.13 or later and pnpm.</p>
            <code>{`git clone https://github.com/Archimatetool/archispark
cd archispark && pnpm install`}</code>
          </article>
          <article>
            <span>2</span>
            <h3>Start the services</h3>
            <p>Create the local environment, then start PostgreSQL.</p>
            <code>{`pnpm env
pnpm infra:up:db`}</code>
          </article>
          <article>
            <span>3</span>
            <h3>Open and explore</h3>
            <p>Run the application, then create or select a workspace.</p>
            <code>{`pnpm dev
open http://localhost:8000/workspaces`}</code>
          </article>
        </div>
      </section>

      <section id="contact" className="landing-contact">
        <div>
          <p className="landing-eyebrow">Contact</p>
          <h2>Let&apos;s talk architecture.</h2>
          <p>
            Tell us about your ArchiMate practice, an integration, or the
            deployment you have in mind.
          </p>
        </div>
        <ContactForm />
      </section>

      <a className="landing-back-to-top" href="#top" aria-label="Back to top">
        ↑
      </a>

      <footer className="landing-footer">
        <span>© 2026 ArchiSpark</span>
        <Link href="/docs/user-guide">User guide</Link>
        <Link href="/docs/developer-guide/reference/mcp-tools">MCP tools</Link>
        <a href="https://github.com/Archimatetool/archispark">GitHub</a>
      </footer>
    </main>
  )
}
