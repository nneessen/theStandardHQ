/*
 * Kinetic statement — cursor-proximity headline over raining matrix letters.
 * The letters host (data-rain) and the kinetic headline (data-kinetic) are
 * React-owned EMPTY containers that initLandingEffects fills imperatively and
 * cleans up on unmount, so React never fights the injected nodes.
 */

const STATEMENT = "SOFTWARE THAT WORKS AS HARD AS YOU DO.";

export function HqKinetic() {
  return (
    <section className="kinetic" id="statement">
      <div className="rain" data-rain />
      <div className="wrap" data-kinwrap>
        {/* data-kinetic holds the text; the effect splits it into per-letter spans */}
        <h2 className="kin-line" data-kinetic={STATEMENT}>
          {STATEMENT}
        </h2>
      </div>
    </section>
  );
}
