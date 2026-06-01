/*
 * Capabilities inventory — 8 categories, ~70 named features. The recruiting
 * "no coming-soon page" proof point. id="capabilities". Content from INVENTORY.
 */

import { staggerStyle } from "../lib/cssVar";
import { Icon } from "../lib/icons";
import { INVENTORY } from "../data/content";

export function HqInventory() {
  return (
    <section className="inventory" id="capabilities">
      <div className="wrap">
        <div className="eyebrow center" data-reveal>
          Every feature, no exceptions
        </div>
        <h2
          className="big"
          data-reveal
          style={staggerStyle(1, { textAlign: "center" })}
        >
          50+ capabilities. All shipped. All in production.
        </h2>
        <p
          className="lead"
          data-reveal
          style={staggerStyle(2, {
            margin: "22px auto 0",
            textAlign: "center",
          })}
        >
          We don&rsquo;t have a &ldquo;coming soon&rdquo; page. Below is the
          complete inventory of what your day-one toolkit looks like.
        </p>
        <div className="inv-grid">
          {INVENTORY.map((cat) => (
            <div className="inv-cat" data-reveal key={cat.title}>
              <div className="cat-h">
                <h3>
                  <span className="ci">
                    <Icon name={cat.icon} />
                  </span>
                  {cat.title}
                </h3>
                <span className="ct">{cat.items.length}</span>
              </div>
              {cat.items.map((name) => (
                <div className="it" key={name}>
                  <b>{name}</b>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
