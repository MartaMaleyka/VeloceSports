import regitecLogoSvg from '../../img/regitec_logo_animado.svg?raw';

export default function LoginHeroBrandMark() {
  return (
    <div className="ds-brand-hero-logo">
      <div
        className="ds-brand-hero-logo__content"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: regitecLogoSvg }}
      />
    </div>
  );
}
