"use client";

import { useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * App-wide page entrance: the main column rises in softly on every navigation.
 * Views with their own choreography (dashboard, reports) layer on top — this
 * just guarantees no product screen pops in flat. Reduced motion → SSR content
 * stays exactly as rendered.
 */
export function MainReveal({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          root.current,
          { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.4, ease: "power3.out", clearProps: "opacity,transform" },
        );
      });
    },
    { scope: root },
  );

  return <div ref={root}>{children}</div>;
}
