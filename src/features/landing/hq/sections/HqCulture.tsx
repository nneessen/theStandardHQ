/*
 * Culture — sticky-scroll photo gallery (3 columns; the middle column sticks).
 * id="culture".
 *
 * Renders ONLY when CULTURE_PHOTOS is non-empty (the page guards it). The
 * reference used a build-time drag-to-fill component that doesn't exist in the
 * deployed SPA; per the no-mock-data rule this stays out until real photo URLs
 * are added to data/culture.ts. Tiles distribute round-robin into 3 columns;
 * the middle column is the sticky one.
 */

import { staggerStyle } from "../lib/cssVar";
import { CULTURE_PHOTOS, type CulturePhoto } from "../data/culture";

function Tile({ photo }: { photo: CulturePhoto }) {
  return (
    <div className="cult-tile">
      <img src={photo.src} alt={photo.label} loading="lazy" />
      <div className="lbl">{photo.label}</div>
    </div>
  );
}

export function HqCulture() {
  const cols: CulturePhoto[][] = [[], [], []];
  CULTURE_PHOTOS.forEach((p, i) => cols[i % 3].push(p));

  return (
    <section className="culture" id="culture">
      <div className="wrap">
        <div className="num-row" data-reveal>
          <span>·</span>
          <b>Culture</b>
        </div>
        <h2 className="big" data-reveal style={staggerStyle(1)}>
          Our people.
        </h2>
        <p className="lead" data-reveal style={staggerStyle(2)}>
          Remote-first, ships weekly, allergic to busywork. The team that builds
          the platform also writes business on it.
        </p>
        <div className="cult-grid">
          {cols.map((col, i) => (
            <div className={`cult-col${i === 1 ? " mid" : ""}`} key={i}>
              {col.map((p) => (
                <Tile photo={p} key={p.src} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
