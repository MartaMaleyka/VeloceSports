SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('pending', 'paid', 'overdue', 'cancelled') NOT NULL DEFAULT 'pending',
  paid_at DATETIME NULL,
  paid_by BIGINT UNSIGNED NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_invoices_tenant_period (tenant_id, period_start, period_end),
  KEY idx_invoices_tenant (tenant_id),
  KEY idx_invoices_status (status),
  KEY idx_invoices_due_date (due_date),
  KEY idx_invoices_period_start (period_start),
  CONSTRAINT fk_invoices_tenant FOREIGN KEY (tenant_id) REFERENCES academies (id),
  CONSTRAINT fk_invoices_plan FOREIGN KEY (plan_id) REFERENCES plans (id),
  CONSTRAINT fk_invoices_paid_by FOREIGN KEY (paid_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
