import Link from 'next/link';

export function FregoWordmark({
  height = 22,
  negative = false,
  href,
  className,
}: {
  height?: number;
  negative?: boolean;
  href?: string;
  className?: string;
}) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={
        negative
          ? '/brand/frego-assinatura-negativa.svg'
          : '/brand/frego-assinatura.svg'
      }
      alt="Frego"
      height={height}
      className={className}
      style={{ height, width: 'auto' }}
    />
  );
  if (!href) return img;
  return (
    <Link href={href} className="inline-flex items-center" aria-label="Frego">
      {img}
    </Link>
  );
}

export function FregoMark({
  size = 28,
  negative = false,
}: {
  size?: number;
  negative?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={
        negative
          ? '/brand/frego-icone-negativo.svg'
          : '/brand/frego-icone-arredondado.svg'
      }
      alt=""
      width={size}
      height={size}
    />
  );
}
