export default function Navbar(): React.ReactElement {
  return (
    <nav className="site-nav">
      <div className="logo">
        <div className="logo-icon">🐋</div>
        SmartWhale
      </div>
      <div className="nav-links">
        <a href="#features">Features</a>
        <a href="#score">Whale Score</a>
        <a href="#pricing">Pricing</a>
        <a href="#">Docs</a>
        <a href="#">Blog</a>
      </div>
      <div className="nav-cta">
        <button className="btn-ghost">Sign in</button>
        <button className="btn-primary">Start Free</button>
      </div>
    </nav>
  )
}
