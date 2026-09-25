import { Particles, ParticlesProvider } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { useReducedMotion } from "framer-motion";

export function ParticleField() {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <ParticlesProvider
        init={async (engine) => {
          await loadSlim(engine);
        }}
      >
        <Particles
          id="bench-particles"
          className="h-full w-full"
          options={{
            fullScreen: { enable: false },
            fpsLimit: 60,
            detectRetina: true,
            background: { color: "transparent" },
            particles: {
              number: { value: 110, density: { enable: true } },
              color: { value: ["#181817", "#6D6B65", "#9B927F"] },
              opacity: { value: { min: 0.45, max: 0.9 } },
              size: { value: { min: 1.6, max: 3.6 } },
              links: {
                enable: true,
                color: "#6D6B65",
                opacity: 0.7,
                distance: 145,
                width: 1.2,
              },
              move: {
                enable: true,
                speed: 0.85,
                direction: "none",
                outModes: "bounce",
              },
            },
            interactivity: {
              detectsOn: "window",
              events: {
                onHover: { enable: true, mode: "grab" },
                resize: { enable: true },
              },
              modes: {
                grab: { distance: 190, links: { opacity: 0.85, color: "#181817" } },
              },
            },
          }}
        />
      </ParticlesProvider>
    </div>
  );
}
