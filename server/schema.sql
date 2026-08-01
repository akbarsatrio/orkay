CREATE TABLE IF NOT EXISTS categories (
  id     VARCHAR(40) PRIMARY KEY,
  name   VARCHAR(255) NOT NULL,
  type   VARCHAR(20) NOT NULL,
  icon   VARCHAR(64),
  color  VARCHAR(20)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS accounts (
  id             VARCHAR(40) PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  type           VARCHAR(20),
  openingBalance BIGINT NOT NULL DEFAULT 0,
  color          VARCHAR(20),
  icon           VARCHAR(64),
  kind           VARCHAR(20) NOT NULL DEFAULT 'cash',
  creditLimit    BIGINT NOT NULL DEFAULT 0,
  closingDay     INT NOT NULL DEFAULT 1,
  dueDay         INT NOT NULL DEFAULT 1,
  dueMonthOffset INT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS income_sources (
  id    VARCHAR(40) PRIMARY KEY,
  name  VARCHAR(255) NOT NULL,
  color VARCHAR(20)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transactions (
  id             VARCHAR(40) PRIMARY KEY,
  type           VARCHAR(20) NOT NULL,
  date           VARCHAR(10) NOT NULL,
  amount         BIGINT NOT NULL,
  categoryId     VARCHAR(40),
  accountId      VARCHAR(40),
  incomeSourceId VARCHAR(40),
  fromAccountId  VARCHAR(40),
  toAccountId    VARCHAR(40),
  fee            BIGINT NOT NULL DEFAULT 0,
  feeCategoryId  VARCHAR(40),
  recurringId    VARCHAR(40),
  installmentId  VARCHAR(40),
  statementPeriod VARCHAR(7),
  note           TEXT,
  INDEX idx_tx_date (date),
  INDEX idx_tx_account (accountId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recurring (
  id               VARCHAR(40) PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  categoryId       VARCHAR(40),
  accountId        VARCHAR(40),
  amount           BIGINT NOT NULL,
  dueDay           INT NOT NULL DEFAULT 1,
  active           TINYINT(1) NOT NULL DEFAULT 1,
  generatedPeriods JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS budgets (
  id         VARCHAR(40) PRIMARY KEY,
  categoryId VARCHAR(40) NOT NULL,
  `limit`    BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
  id       INT PRIMARY KEY,
  payDay   INT NOT NULL DEFAULT 28,
  theme    VARCHAR(20) NOT NULL DEFAULT 'light',
  currency VARCHAR(10) NOT NULL DEFAULT 'IDR'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS installments (
  id               VARCHAR(40) PRIMARY KEY,
  accountId        VARCHAR(40) NOT NULL,
  categoryId       VARCHAR(40),
  name             VARCHAR(255) NOT NULL,
  purchaseDate     VARCHAR(10) NOT NULL,
  principalTotal   BIGINT NOT NULL,
  tenor            INT NOT NULL,
  monthlyAmount    BIGINT NOT NULL,
  interestPerMonth BIGINT NOT NULL DEFAULT 0,
  paidCount        INT NOT NULL DEFAULT 0,
  active           TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_inst_account (accountId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
