export default function Footer(): React.ReactElement {
  return (
    <footer>
      <div className="footer-left">
        <div className="logo" style={{ fontSize: '1rem' }}>
          <div className="logo-icon" style={{ width: '26px', height: '26px', fontSize: '0.8rem' }}>🐋</div>
          SmartWhale
        </div>
        <div className="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Docs</a>
          <a href="#">Status</a>
          <a href="#">Twitter</a>
        </div>
      </div>
      <div className="footer-right">© 2026 SmartWhale — All chains. All alpha.</div>
    </footer>
  )
}
