import React from 'react';

interface Stat {
  number: string;
  label: string;
}

interface StatsSectionProps {
  stats: Stat[];
}

export function StatsSection({ stats }: StatsSectionProps) {
  return (
    <div className="stats-container">
      <div className="stats-grid">
        {stats.map((stat, idx) => (
          <div key={idx} className="stat-item">
            <div className="stat-number">{stat.number}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
      <style>{`
        .stats-container {
          background: linear-gradient(135deg, rgba(163, 230, 53, 0.15) 0%, transparent 50%);
          padding: 3rem 0;
          margin: 3rem 0;
          border-radius: 16px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 2rem;
          text-align: center;
        }

        .stat-item {
          padding: 1.5rem;
        }

        .stat-number {
          font-size: 2.5rem;
          font-weight: 800;
          color: #a3e635;
          margin-bottom: 0.5rem;
          font-family: 'Space Grotesk', system-ui, sans-serif;
        }

        .stat-label {
          font-size: 0.95rem;
          color: #52525b;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
