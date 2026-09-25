import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

export function ScrollRail() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const transform = useTransform(scrollYProgress, (progress) => `scaleX(${progress})`);

  if (reduce) return <div className="sticky top-16 z-20 h-px bg-border" />;

  return (
    <div className="sticky top-16 z-20 h-px bg-border" aria-hidden="true">
      <motion.div className="h-px origin-left bg-[var(--mark)]" style={{ transform }} />
    </div>
  );
}
