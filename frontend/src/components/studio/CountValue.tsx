import { animate } from "animejs";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

type CountValueProps = {
  value: number;
};

export function CountValue({ value }: CountValueProps) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const fromRef = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    if (reduce) {
      node.textContent = String(value);
      fromRef.current = value;
      return;
    }

    const state = { n: fromRef.current };
    const animation = animate(state, {
      n: value,
      duration: 700,
      ease: "outCubic",
      onUpdate: () => {
        node.textContent = String(Math.round(state.n));
      },
    });
    fromRef.current = value;

    return () => {
      animation.pause();
    };
  }, [reduce, value]);

  return <span ref={nodeRef}>{value}</span>;
}
