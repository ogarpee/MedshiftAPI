type MedShiftLogoProps = {
  href?: string;
};

export function MedShiftLogo({ href }: MedShiftLogoProps) {
  const content = (
    <>
      <svg className="medshift-logo-mark" viewBox="0 0 48 48" role="img" aria-hidden="true" focusable="false">
        <rect width="48" height="48" rx="12" fill="#0B1F3A" />
        <path d="M24 10v28M10 24h28" stroke="#D4AF37" strokeWidth="6" strokeLinecap="round" />
        <path d="M15 31c4.2 4.6 13.8 4.6 18 0" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
      </svg>
      <span className="medshift-logo-wordmark">
        Med<span>Shift</span>
      </span>
    </>
  );

  if (href) {
    return (
      <a className="medshift-logo" href={href} aria-label="MedShift home">
        {content}
      </a>
    );
  }

  return (
    <span className="medshift-logo" aria-label="MedShift">
      {content}
    </span>
  );
}
