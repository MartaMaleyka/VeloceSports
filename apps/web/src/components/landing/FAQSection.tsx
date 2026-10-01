import React, { useState } from 'react';

interface FAQ {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  faqs: FAQ[];
  title?: string;
}

export function FAQSection({ faqs, title = 'Preguntas Frecuentes' }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="faq-container">
      <h2>{title}</h2>
      <div className="faq-list">
        {faqs.map((faq, idx) => (
          <div key={idx} className={`faq-item ${openIndex === idx ? 'open' : ''}`}>
            <button
              className="faq-question"
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              aria-expanded={openIndex === idx}
            >
              <span>{faq.question}</span>
              <span className="faq-icon">
                {openIndex === idx ? '−' : '+'}
              </span>
            </button>
            {openIndex === idx && (
              <div className="faq-answer">
                <p>{faq.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <style>{`
        .faq-container {
          max-width: 800px;
          margin: 0 auto;
          width: 100%;
        }

        .faq-container h2 {
          text-align: center;
          margin-bottom: 2rem;
          color: #111827;
        }

        .faq-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .faq-item {
          border: 1px solid #e4e4e7;
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.3s ease;
          background: white;
        }

        .faq-item:hover {
          border-color: #a3e635;
          box-shadow: 0 4px 12px rgba(163, 230, 53, 0.1);
        }

        .faq-question {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 600;
          color: #111827;
          text-align: left;
          transition: all 0.3s ease;
        }

        .faq-question:hover {
          color: #a3e635;
        }

        .faq-icon {
          flex-shrink: 0;
          font-size: 1.5rem;
          margin-left: 1rem;
          color: #a3e635;
          font-weight: 300;
          transition: transform 0.3s ease;
        }

        .faq-item.open .faq-icon {
          transform: rotate(180deg);
        }

        .faq-answer {
          padding: 0 1.25rem 1.25rem 1.25rem;
          border-top: 1px solid #e4e4e7;
          animation: slideDown 0.3s ease;
        }

        .faq-answer p {
          color: #52525b;
          line-height: 1.6;
          margin: 0;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 640px) {
          .faq-question {
            font-size: 0.95rem;
          }
        }
      `}</style>
    </div>
  );
}
