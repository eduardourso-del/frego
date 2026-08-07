'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useInView } from 'framer-motion';

/** Counts up once when the metric enters the viewport. */
export function AnimatedCounter({
  value,
  decimals = 0,
  suffix = '',
  prefix = '',
  className,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [display, setDisplay] = useState(decimals > 0 ? '0.0' : '0');

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 1.35,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        setDisplay(
          decimals > 0
            ? v.toFixed(decimals).replace('.', ',')
            : Math.round(v).toLocaleString('pt-BR'),
        );
      },
    });
    return () => controls.stop();
  }, [inView, value, decimals]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
