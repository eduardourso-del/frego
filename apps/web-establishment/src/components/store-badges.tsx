import type { ReactNode } from 'react';

const APP_STORE_URL =
  'https://apps.apple.com/br/app/frego-clube-de-benef%C3%ADcios/id6799090522';

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.bearlabs.frego';

function AppleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
    </svg>
  );
}

function PlayMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M3 20.5V3.5c0-.59.34-1.11.84-1.35L13.69 12 3.84 21.85A1.5 1.5 0 0 1 3 20.5z"
      />
      <path
        fill="#34A853"
        d="m16.81 15.12-3.12-3.12 3.12-3.12 3.35 1.92c.8.46.8 1.94 0 2.4l-3.35 1.92z"
      />
      <path fill="#FBBC04" d="M6.05 21.34 14.54 12.85l2.27 2.27-10.76 6.22z" />
      <path fill="#EA4335" d="M6.05 2.66 16.81 8.88 14.54 11.15 6.05 2.66z" />
    </svg>
  );
}

function StoreBadge({
  href,
  kicker,
  label,
  icon,
}: {
  href: string;
  kicker: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${kicker} ${label}`}
      className="inline-flex h-12 min-w-[158px] items-center gap-2.5 rounded-[10px] bg-[var(--color-ink)] px-3.5 text-white transition-[transform,opacity] hover:opacity-90 active:scale-[0.98]"
    >
      <span className="flex w-5 shrink-0 items-center justify-center">{icon}</span>
      <span className="flex flex-col items-start leading-none">
        <span className="text-[10px] font-medium text-white/75">{kicker}</span>
        <span className="mt-1 text-[15px] font-semibold tracking-[-0.02em]">
          {label}
        </span>
      </span>
    </a>
  );
}

export function StoreBadges({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <StoreBadge
        href={APP_STORE_URL}
        kicker="Baixar na"
        label="App Store"
        icon={<AppleMark />}
      />
      <StoreBadge
        href={PLAY_STORE_URL}
        kicker="Disponível no"
        label="Google Play"
        icon={<PlayMark />}
      />
    </div>
  );
}
