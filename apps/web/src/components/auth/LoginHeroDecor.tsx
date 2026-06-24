/** Decoración visual del hero de login (sin lógica). */
export default function LoginHeroDecor() {
  return (
    <>
      <div className="ds-brand-page__hero-backdrop" aria-hidden="true">
        <div className="ds-brand-page__aurora" />
        <div className="ds-brand-page__orb ds-brand-page__orb--1" />
        <div className="ds-brand-page__orb ds-brand-page__orb--2" />
        <div className="ds-brand-page__orb ds-brand-page__orb--3" />
      </div>
      <div className="ds-brand-page__hero-pattern" aria-hidden="true" />
      <div className="ds-brand-page__hero-glow" aria-hidden="true" />
      <div className="ds-brand-page__hero-wave" aria-hidden="true">
        <svg viewBox="0 0 120 800" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path
            className="ds-brand-page__hero-wave-path"
            d="M0,0 C40,120 80,200 60,400 C40,600 90,680 120,800 L120,0 Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </>
  );
}

export function LoginPanelDecor() {
  return (
    <div className="ds-brand-page__panel-backdrop" aria-hidden="true">
      <div className="ds-brand-page__panel-blob ds-brand-page__panel-blob--1" />
      <div className="ds-brand-page__panel-blob ds-brand-page__panel-blob--2" />
      <div className="ds-brand-page__panel-grid" />
    </div>
  );
}
