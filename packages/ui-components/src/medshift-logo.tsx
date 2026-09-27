type MedShiftLogoProps = {
  href?: string;
};

export function MedShiftLogo({ href }: MedShiftLogoProps) {
  const content = (
    <>
      <img className="medshift-logo-mark" src="/brand-logo-icon.png" alt="" aria-hidden="true" />
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
