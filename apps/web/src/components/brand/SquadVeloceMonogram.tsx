/** Isotipo temporal SquadVeloce (S + V/check + estrella de velocidad) para el sidebar.
 * Sustituir por isotype-*.svg oficiales cuando Marta los entregue.
 */
export function SquadVeloceMonogram({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      width={40}
      height={40}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {/* S estilizada */}
      <path
        d="M28.5 11.2c-.9-2.4-3.2-4-6.2-4.2-4.2-.2-7.4 2.1-7.6 5.4-.1 2.2 1.2 3.8 3.6 4.7l6.2 2.3c3.4 1.2 5.4 3.5 5.2 6.8-.3 4.4-4.2 7.2-9.4 7.4-4.1.2-7.6-1.6-9.1-4.9l3.3-1.7c1 2.1 3.4 3.4 6 3.3 3.4-.1 5.8-1.9 5.9-4.4.1-2.1-1.3-3.5-4-4.5l-6.1-2.2c-3.8-1.4-5.8-3.9-5.5-7.5C11.1 7.2 15.5 4 21.8 4.3c4.2.2 7.5 2.4 8.9 5.7l-2.2 1.2z"
        fill="currentColor"
      />
      {/* V / check marca */}
      <path
        d="M18.2 22.5 24.8 32.8c.35.55 1.15.55 1.5 0L37.2 12.4c.28-.45-.04-1.05-.58-1.05h-3.1c-.28 0-.54.14-.69.38L25.5 25.2 21.1 18.4c-.16-.25-.44-.4-.74-.4h-1.55c-.62 0-.97.7-.61 1.2z"
        fill="var(--color-brand, #a3e635)"
      />
      {/* Estrella de velocidad (deportes en general — sin balón) */}
      <path
        d="M16.2 19.2l1.35 2.85 3.15.4-2.3 2.15.6 3.1-2.8-1.55-2.8 1.55.6-3.1-2.3-2.15 3.15-.4z"
        fill="var(--color-brand, #a3e635)"
      />
      <path
        d="M11.2 24.2h3.4M12.4 26.4h2.6"
        stroke="var(--color-brand, #a3e635)"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}
