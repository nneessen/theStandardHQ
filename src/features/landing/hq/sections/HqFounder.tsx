/*
 * Founder — hover clip-path reveal card + bio + meta. id="founder" (nav anchor
 * "Opportunity"). Copy is static and matches the reference verbatim.
 */

import { staggerStyle } from "../lib/cssVar";

export function HqFounder() {
  return (
    <section className="founder" id="founder">
      <div className="wrap">
        <div className="num-row" data-reveal>
          <span>03</span>
          <b>Meet the Founder</b>
        </div>
        <h2 className="big" data-reveal style={staggerStyle(1)}>
          Built by a producer
          <br />
          who got tired of bad software.
        </h2>
        <div className="founder-grid">
          <div className="reveal-card" data-reveal>
            <div className="rc-base">
              <span className="rc-hint">Hover</span>
              <div className="rc-mono">NN</div>
              <div className="rc-role" style={{ marginTop: "18px" }}>
                Founder · Producer · Engineer
              </div>
              <div className="rc-name">Nick Neessen</div>
            </div>
            <div className="rc-over">
              <span className="rc-hint">Recruiting now</span>
              <div className="rc-mono">NN</div>
              <div className="rc-role" style={{ marginTop: "18px" }}>
                The Standard HQ
              </div>
              <div className="rc-name">Let&rsquo;s build.</div>
            </div>
          </div>
          <div className="founder-body" data-reveal style={staggerStyle(1)}>
            <p>
              I&rsquo;m not a call center disguised as an agency. I&rsquo;m a
              producer who got tired of paying $500/month for tools that
              didn&rsquo;t talk to each other, manually reconciling commissions
              in Excel, and watching good leads die because nobody picked up the
              phone in time.
            </p>
            <p>
              So I built my own platform. <b>AI scores every lead</b> in our
              pipeline. AI writes our outbound sequences. The underwriting
              wizard recommends carriers in three minutes. Training is a game
              with badges and leaderboards.{" "}
              <b>Commissions calculate themselves.</b>
            </p>
            <p>
              Now I&rsquo;m recruiting agents who want to work with software
              that actually moves the needle.
            </p>
            <div className="founder-meta">
              <div>
                <div className="l">Approach</div>
                <div className="v">AI-first, built and owned in-house</div>
              </div>
              <div>
                <div className="l">Built where</div>
                <div className="v">
                  In-house, on weekends, by an agent who writes business
                </div>
              </div>
              <div>
                <div className="l">Sold</div>
                <div className="v">
                  Never · internal-only software, not for license
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
