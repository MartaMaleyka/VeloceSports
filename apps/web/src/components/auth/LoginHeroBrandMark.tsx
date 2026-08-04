export default function LoginHeroBrandMark() {
  const base =
    typeof import.meta.env.BASE_URL === 'string'
      ? import.meta.env.BASE_URL.replace(/\/?$/, '/')
      : '/';
  const logoSrc = `${base}brand/logo-dark.png`;

  return (
    <div className="ds-brand-hero-logo">
      <div className="ds-brand-hero-logo__content">
        <img
          src={logoSrc}
          alt=""
          width={640}
          height={640}
          className="ds-brand-hero-logo__img ds-brand-hero-logo__img--dark"
          decoding="async"
          fetchPriority="high"
        />
      </div>
    </div>
  );
}
