-- ============================================================================
-- Migration: 014_wallet_frozen_balance.sql
-- Description: 为 wallets 表新增 frozen_balance 字段，以支持拍卖竞价等业务的原子资金冻结。
-- ============================================================================

ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS frozen_balance NUMERIC(20, 2) NOT NULL DEFAULT 0.00 CHECK (frozen_balance >= 0);

COMMENT ON COLUMN wallets.frozen_balance IS '拍卖竞价等业务冻结资金，可用余额为 balance';
