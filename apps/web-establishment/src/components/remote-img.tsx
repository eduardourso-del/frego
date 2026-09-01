'use client';

import { useEffect, useState } from 'react';

/** External logos/photos (Unsplash, Firebase). No referrer — Unsplash often 403s with one. */
export function RemoteImg({
  src,
  alt = '',
  className,
  onError,
}: {
  src: string;
  alt?: string;
  className?: string;
  onError?: () => void;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      decoding="async"
      onError={onError}
    />
  );
}

export function BusinessLogo({
  src,
  letter,
  className,
  letterClassName,
  background,
}: {
  src: string | null | undefined;
  letter: string;
  className: string;
  letterClassName: string;
  background: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src?.trim() || failed) {
    return (
      <div
        className={letterClassName}
        style={{ background }}
        aria-hidden
      >
        {letter}
      </div>
    );
  }

  return (
    <RemoteImg
      src={src}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
