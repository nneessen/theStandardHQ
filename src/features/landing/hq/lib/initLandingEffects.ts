/*
 * initLandingEffects — the single imperative animation initializer for the HQ
 * landing page. Ported from docs/todo/landing/effects.js, hardened for a React
 * SPA. One useEffect in PublicLandingPage calls this once on mount and runs the
 * returned cleanup on unmount.
 *
 * Contract (per architecture review):
 *  - All work is gated/contained so a thrown error NEVER leaves content hidden:
 *    we add the `.fx` class (which enables the reveal hidden-states) FIRST, then
 *    immediately attach the reveal observer; the whole body is wrapped in
 *    try/catch and on any throw we strip `.fx` so the page falls back to fully
 *    visible.
 *  - In-viewport `[data-reveal]` elements are flushed to `.in` synchronously in
 *    the same task as the `.fx` add, so there is no one-frame flash of hidden
 *    hero content.
 *  - A SINGLE rAF-throttled scroll handler drives nav state, the progress bar,
 *    every horizontal scroll-pin track, and the command-center scroll-tilt — so
 *    there is one listener and one batched layout read per frame, not three.
 *  - Reduced motion: when `reducedMotion` is true we do NOT add `.fx` (CSS
 *    `:not(.fx)` fallbacks un-pin the scroll sections and reveal content shows),
 *    count-up / scramble resolve instantly, and the pointer/scroll/DOM-spawning
 *    effects (glow, tilt, magnet, kinetic, rain, hscroll, scroll-tilt) are
 *    skipped entirely.
 *  - Everything registers a teardown into `cleanups`; the returned function runs
 *    them all (observers disconnect, listeners removed, rAF/intervals cancelled,
 *    spawned nodes removed).
 *
 * All element queries are scoped to `root` (the `.theme-hq` wrapper); only the
 * window-level scroll/pointer listeners are global, and they read root-scoped
 * element lists captured at init.
 */

type Cleanup = () => void;

export function initLandingEffects(
  root: HTMLElement,
  opts: { reducedMotion: boolean },
): Cleanup {
  const { reducedMotion } = opts;
  const cleanups: Cleanup[] = [];
  const fxEnabled = !reducedMotion;

  const inViewport = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  };

  try {
    // ── reveal-on-scroll (must be first; enables .fx hidden-states safely) ──
    if (fxEnabled) {
      root.classList.add("fx");
      const reveals = [...root.querySelectorAll<HTMLElement>("[data-reveal]")];
      // Flush anything already on-screen synchronously → no hidden-content flash.
      const pending: HTMLElement[] = [];
      for (const el of reveals) {
        if (inViewport(el)) el.classList.add("in");
        else pending.push(el);
      }
      const revealIO = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("in");
              revealIO.unobserve(e.target);
            }
          });
        },
        { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
      );
      pending.forEach((el) => revealIO.observe(el));
      cleanups.push(() => revealIO.disconnect());
    }

    // ── count-up (animates when fx; resolves instantly under reduced motion) ──
    const fmt = (n: number, pre: string, suf: string) =>
      pre + Math.round(n).toLocaleString() + suf;
    const counts = [...root.querySelectorAll<HTMLElement>("[data-count]")];
    if (counts.length) {
      const countIO = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            countIO.unobserve(e.target);
            const el = e.target as HTMLElement;
            const to = parseFloat(el.dataset.count || "0");
            const pre = el.dataset.pre || "";
            const suf = el.dataset.suf || "";
            if (reducedMotion) {
              el.textContent = fmt(to, pre, suf);
              return;
            }
            const dur = 1400;
            const t0 = performance.now();
            const tick = (t: number) => {
              const p = Math.min(1, (t - t0) / dur);
              const eased = 1 - Math.pow(1 - p, 3);
              el.textContent = fmt(to * eased, pre, suf);
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
        },
        { threshold: 0.6 },
      );
      counts.forEach((el) => countIO.observe(el));
      cleanups.push(() => countIO.disconnect());
    }

    // ── matrix scramble (headlines) ──
    const scrambleEls = [
      ...root.querySelectorAll<HTMLElement>("[data-scramble]"),
    ];
    if (scrambleEls.length) {
      const GLYPHS = "01";
      const runScramble = (el: HTMLElement) => {
        const final = el.dataset.scramble ?? el.textContent ?? "";
        if (reducedMotion) {
          el.textContent = final;
          return;
        }
        const chars = [...final];
        const hold = chars.map((c, i) =>
          c === " " ? 9999 : 2 + i * 1.4 + Math.random() * 3,
        );
        let frame = 0;
        let alive = true;
        cleanups.push(() => {
          alive = false;
        });
        const run = () => {
          if (!alive) return;
          let out = "";
          let done = true;
          for (let i = 0; i < chars.length; i++) {
            if (chars[i] === " ") {
              out += " ";
              continue;
            }
            if (frame >= hold[i]) out += chars[i];
            else {
              out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
              done = false;
            }
          }
          el.textContent = out;
          frame++;
          if (!done) requestAnimationFrame(run);
          else el.textContent = final;
        };
        run();
      };
      const scrIO = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              scrIO.unobserve(e.target);
              runScramble(e.target as HTMLElement);
            }
          });
        },
        { threshold: 0.5 },
      );
      scrambleEls.forEach((el) => scrIO.observe(el));
      cleanups.push(() => scrIO.disconnect());
    }

    // ── scramble-on-hover (button labels) ──
    const SCH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*0123456789";
    root
      .querySelectorAll<HTMLElement>("[data-scramble-hover]")
      .forEach((el) => {
        const final = el.dataset.scrambleHover || el.textContent || "";
        const host = el.closest(".btn") || el;
        let raf = 0;
        const onEnter = () => {
          if (reducedMotion) return;
          let f = 0;
          const tot = final.length * 3;
          cancelAnimationFrame(raf);
          const run = () => {
            f++;
            const rev = Math.floor(f / 3);
            el.textContent = final
              .split("")
              .map((c, i) =>
                c === " "
                  ? " "
                  : i < rev
                    ? c
                    : SCH[Math.floor(Math.random() * SCH.length)],
              )
              .join("");
            if (f < tot) raf = requestAnimationFrame(run);
            else el.textContent = final;
          };
          run();
        };
        host.addEventListener("mouseenter", onEnter);
        cleanups.push(() => {
          host.removeEventListener("mouseenter", onEnter);
          cancelAnimationFrame(raf);
        });
      });

    // Pointer / scroll / DOM-spawning effects — skip entirely under reduced motion.
    if (fxEnabled) {
      // ── glow border (per-card local coords; hover-gated in CSS) ──
      const glows = [...root.querySelectorAll<HTMLElement>("[data-glow]")];
      if (glows.length) {
        const onMove = (e: PointerEvent) => {
          for (const c of glows) {
            const r = c.getBoundingClientRect();
            if (
              e.clientX < r.left - 40 ||
              e.clientX > r.right + 40 ||
              e.clientY < r.top - 40 ||
              e.clientY > r.bottom + 40
            )
              continue;
            c.style.setProperty("--mx", `${e.clientX - r.left}px`);
            c.style.setProperty("--my", `${e.clientY - r.top}px`);
          }
        };
        window.addEventListener("pointermove", onMove, { passive: true });
        cleanups.push(() => window.removeEventListener("pointermove", onMove));
      }

      // ── 3D tilt cards ──
      root.querySelectorAll<HTMLElement>("[data-tilt]").forEach((card) => {
        const max = 7;
        const onMove = (e: PointerEvent) => {
          const r = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          card.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
          card.style.setProperty("--gx", `${((px + 0.5) * 100).toFixed(1)}%`);
          card.style.setProperty("--gy", `${((py + 0.5) * 100).toFixed(1)}%`);
        };
        const onLeave = () => {
          card.style.transform = "perspective(900px) rotateX(0) rotateY(0)";
        };
        card.addEventListener("pointermove", onMove);
        card.addEventListener("pointerleave", onLeave);
        cleanups.push(() => {
          card.removeEventListener("pointermove", onMove);
          card.removeEventListener("pointerleave", onLeave);
        });
      });

      // ── magnetic buttons ──
      root.querySelectorAll<HTMLElement>("[data-magnet]").forEach((btn) => {
        const onMove = (e: PointerEvent) => {
          const r = btn.getBoundingClientRect();
          btn.style.transform = `translate(${((e.clientX - r.left) / r.width - 0.5) * 12}px, ${((e.clientY - r.top) / r.height - 0.5) * 12}px)`;
        };
        const onLeave = () => {
          btn.style.transform = "translate(0,0)";
        };
        btn.addEventListener("pointermove", onMove);
        btn.addEventListener("pointerleave", onLeave);
        cleanups.push(() => {
          btn.removeEventListener("pointermove", onMove);
          btn.removeEventListener("pointerleave", onLeave);
        });
      });

      // ── cursor-proximity kinetic text ──
      root.querySelectorAll<HTMLElement>("[data-kinetic]").forEach((el) => {
        const text = el.dataset.kinetic || el.textContent || "";
        el.innerHTML = text
          .split("")
          .map((c) =>
            c === " "
              ? '<span class="sp">&nbsp;</span>'
              : `<span class="kl">${c}</span>`,
          )
          .join("");
        const wrap = (el.closest("[data-kinwrap]") as HTMLElement) || el;
        const letters = [...el.querySelectorAll<HTMLElement>(".kl")];
        let mx = -9999;
        let my = -9999;
        const onMove = (e: PointerEvent) => {
          mx = e.clientX;
          my = e.clientY;
        };
        const onLeave = () => {
          mx = my = -9999;
        };
        wrap.addEventListener("pointermove", onMove);
        wrap.addEventListener("pointerleave", onLeave);
        const R = 165;
        const A = [241, 233, 214];
        const B = [70, 216, 245];
        let raf = 0;
        const loop = () => {
          for (const l of letters) {
            const r = l.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const p = Math.max(0, 1 - Math.hypot(mx - cx, my - cy) / R);
            l.style.transform = `scale(${(1 + p * 0.55).toFixed(3)}) translateY(${(-p * 5).toFixed(1)}px)`;
            l.style.color =
              p > 0.02
                ? `rgb(${Math.round(A[0] + (B[0] - A[0]) * p)},${Math.round(A[1] + (B[1] - A[1]) * p)},${Math.round(A[2] + (B[2] - A[2]) * p)})`
                : "";
            l.style.textShadow =
              p > 0.25
                ? `0 0 ${(p * 16).toFixed(0)}px rgba(70,216,245,${(p * 0.6).toFixed(2)})`
                : "";
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        cleanups.push(() => {
          cancelAnimationFrame(raf);
          wrap.removeEventListener("pointermove", onMove);
          wrap.removeEventListener("pointerleave", onLeave);
        });
      });

      // ── raining letters (matrix) ──
      root.querySelectorAll<HTMLElement>("[data-rain]").forEach((host) => {
        const G = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*";
        const N = 70;
        const items: HTMLElement[] = [];
        for (let i = 0; i < N; i++) {
          const s = document.createElement("span");
          s.className = "rain-ch";
          s.textContent = G[Math.floor(Math.random() * G.length)];
          s.style.left = `${(Math.random() * 100).toFixed(2)}%`;
          const dur = 6 + Math.random() * 8;
          s.style.animationDuration = `${dur}s`;
          s.style.animationDelay = `${-Math.random() * dur}s`;
          s.style.fontSize = `${(10 + Math.random() * 12).toFixed(0)}px`;
          host.appendChild(s);
          items.push(s);
        }
        const swap = window.setInterval(() => {
          const s = items[Math.floor(Math.random() * items.length)];
          s.textContent = G[Math.floor(Math.random() * G.length)];
        }, 120);
        cleanups.push(() => {
          clearInterval(swap);
          items.forEach((s) => s.remove());
        });
      });
    }

    // ── in-page anchor smooth-scroll (delegated; auto under reduced motion) ──
    const onAnchorClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>(
        'a[href^="#"]',
      );
      if (!a) return;
      const id = a.getAttribute("href")?.slice(1);
      if (!id) return;
      const target = root.querySelector(`#${CSS.escape(id)}`);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    };
    root.addEventListener("click", onAnchorClick);
    cleanups.push(() => root.removeEventListener("click", onAnchorClick));

    // ── unified rAF-throttled scroll handler (nav + progress + hscroll + tilt) ──
    const nav = root.querySelector<HTMLElement>("[data-nav]");
    const bar = root.querySelector<HTMLElement>("[data-progress]");
    const hsections = fxEnabled
      ? [...root.querySelectorAll<HTMLElement>("[data-hscroll]")].map(
          (sec) => ({
            sec,
            track: sec.querySelector<HTMLElement>("[data-htrack]"),
          }),
        )
      : [];
    const tiltCards = fxEnabled
      ? [...root.querySelectorAll<HTMLElement>("[data-tilt-card]")]
      : [];

    let scrollRaf = 0;
    const applyScroll = () => {
      scrollRaf = 0;
      const sy = window.scrollY;
      if (nav) nav.classList.toggle("scrolled", sy > 40);
      if (bar) {
        const h = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = `scaleX(${h > 0 ? sy / h : 0})`;
      }
      for (const { sec, track } of hsections) {
        if (!track) continue;
        const total = sec.offsetHeight - window.innerHeight;
        const p = Math.min(
          1,
          Math.max(0, -sec.getBoundingClientRect().top / total),
        );
        const max = track.scrollWidth - window.innerWidth + 80;
        track.style.transform = `translateX(${-p * max}px)`;
      }
      for (const card of tiltCards) {
        const r = card.getBoundingClientRect();
        const p = Math.min(
          1,
          Math.max(
            0,
            1 -
              (r.top - window.innerHeight * 0.15) / (window.innerHeight * 0.7),
          ),
        );
        card.style.transform = `perspective(1500px) rotateX(${((1 - p) * 24).toFixed(2)}deg) scale(${(0.94 + p * 0.06).toFixed(3)})`;
      }
    };
    const onScroll = () => {
      if (!scrollRaf) scrollRaf = requestAnimationFrame(applyScroll);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    applyScroll(); // initial paint (progress bar, pinned tracks)
    cleanups.push(() => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(scrollRaf);
    });
  } catch {
    // On any init failure, fall back to fully-visible content and tear down
    // whatever did attach.
    root.classList.remove("fx");
    cleanups.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
    return () => {};
  }

  return () => {
    cleanups.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  };
}
