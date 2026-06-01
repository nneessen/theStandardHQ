/*
 * Footer — brand + description, contact, and real links (Terms/Privacy/Login
 * via router). Contact details are the founder's, per the reference.
 */

import { Link } from "@tanstack/react-router";

export function HqFooter() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <a className="brand" href="#top">
              <span className="mark">
                <span>S</span>
              </span>{" "}
              THE STANDARD
            </a>
            <p className="desc">
              The agency built like a tech company. Recruiting agents who want
              better software, real downline overrides, and a team that ships.
            </p>
          </div>
          <div className="foot-col">
            <h4>Contact</h4>
            <a href="mailto:nick@nickneessen.com">nick@nickneessen.com</a>
            <a href="tel:+18594335907">859 433 5907</a>
            <span
              style={{
                display: "block",
                fontFamily: "var(--mono)",
                fontSize: "13.5px",
                color: "var(--mut)",
              }}
            >
              Denver, CO
            </span>
          </div>
          <div className="foot-col">
            <h4>Links</h4>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/accessibility">Accessibility</Link>
            <Link to="/login">Agent Login</Link>
          </div>
        </div>
        <div className="foot-bottom">
          <span>
            © {new Date().getFullYear()} Nick Neessen. The Standard HQ™ is owned
            and operated by Nick Neessen.
          </span>
          <span>
            Built in-house. Owned end to end — not for sale or license to any
            other agency.
          </span>
        </div>
      </div>
    </footer>
  );
}
