/**
 * Stopgap: logo completo reducido (~90px) hasta disponer del SVG del isotipo SV+balón.
 * Sustituir por `/brand/isotype-*.svg` cuando lleguen los originales.
 */
export default function LoginPanelBrandMark() {
  const base =
    typeof import.meta.env.BASE_URL === 'string'
      ? import.meta.env.BASE_URL.replace(/\/?$/, '/')
      : '/';

  return (
    <div className="ds-brand-card__mark" aria-hidden="true">
      <img
        src={`${base}brand/logo-light.png`}
        alt=""
        width={90}
        height={90}
        className="ds-brand-card__mark-img ds-brand-card__mark-img--light"
        decoding="async"
      />
      <img
        src={`${base}brand/logo-dark.png`}
        alt=""
        width={90}
        height={90}
        className="ds-brand-card__mark-img ds-brand-card__mark-img--dark"
        decoding="async"
      />
    </div>
  );
}
