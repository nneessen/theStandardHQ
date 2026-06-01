/*
 * FAQ accordion (native React state, single-open) + an "Ask Jarvis" prompt that
 * scrolls to the Jarvis showcase. id="faq". Content from FAQ.
 */

import { useState } from "react";
import { staggerStyle } from "../lib/cssVar";
import { FAQ } from "../data/content";

export function HqFaq() {
  const [open, setOpen] = useState(0);

  return (
    <section className="faq" id="faq">
      <div className="wrap">
        <div className="eyebrow center" data-reveal>
          Common Questions
        </div>
        <h2
          className="big"
          data-reveal
          style={staggerStyle(1, { textAlign: "center" })}
        >
          Quick answers.
        </h2>
        <div className="faq-list">
          {FAQ.map((f, i) => (
            <div className={`faq-item${open === i ? " open" : ""}`} key={f.q}>
              <button
                type="button"
                className="faq-q"
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? -1 : i)}
              >
                {f.q}
                <span className="pm">+</span>
              </button>
              <div className="faq-a">
                <p>{f.a}</p>
              </div>
            </div>
          ))}
        </div>
        <a className="faq-jarvis" href="#jarvis" data-reveal>
          <span className="fj-orb" />
          <span className="fj-t">
            <b>Still have questions?</b>
            <p>
              Ask Jarvis anything — it answers in plain English, day or night.
            </p>
          </span>
          <span className="btn btn-ghost" style={{ pointerEvents: "none" }}>
            Ask Jarvis →
          </span>
        </a>
      </div>
    </section>
  );
}
