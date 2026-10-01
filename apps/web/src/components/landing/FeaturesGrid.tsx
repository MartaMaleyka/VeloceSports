import React from 'react';

interface Feature {
  icon: string;
  title: string;
  description: string;
}

interface FeaturesGridProps {
  features: Feature[];
}

export function FeaturesGrid({ features }: FeaturesGridProps) {
  return (
    <div className="features-grid">
      {features.map((feature, idx) => (
        <div key={idx} className="feature-card">
          <div className="feature-icon">{feature.icon}</div>
          <h3>{feature.title}</h3>
          <p>{feature.description}</p>
        </div>
      ))}
      <style>{`
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin: 2rem 0;
        }

        .feature-card {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          border: 1px solid #e4e4e7;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .feature-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 4px;
          height: 100%;
          background: #a3e635;
          transform: scaleY(0);
          transform-origin: top;
          transition: transform 0.3s;
        }

        .feature-card:hover {
          border-color: #a3e635;
          box-shadow: 0 10px 30px rgba(163, 230, 53, 0.15);
          transform: translateY(-5px);
        }

        .feature-card:hover::before {
          transform: scaleY(1);
        }

        .feature-icon {
          font-size: 2.5rem;
          margin-bottom: 1rem;
          display: block;
        }

        .feature-card h3 {
          font-size: 1.25rem;
          margin-bottom: 0.75rem;
          color: #111827;
          font-weight: 600;
        }

        .feature-card p {
          color: #52525b;
          line-height: 1.6;
          font-size: 0.95rem;
        }
      `}</style>
    </div>
  );
}
