-- ============================================================================
-- 003_add_max_bet_amount.sql
-- 变更目的：为 race_rule_configs 规则配置表添加单笔最大下注额字段 (max_bet_amount)
-- 保证服务层与数据库模式定义一致，防止大额资金异常穿透与 EF Core 映射异常
-- ============================================================================

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'race_rule_configs' AND column_name = 'max_bet_amount'
    ) THEN
        ALTER TABLE race_rule_configs 
        ADD COLUMN max_bet_amount NUMERIC(20,2) NOT NULL DEFAULT 10000.00 CHECK (max_bet_amount >= 0);

        COMMENT ON COLUMN race_rule_configs.max_bet_amount IS '单笔下注最高金额上限（默认 10000.00 币，0 表示不限）';
    END IF;
END $$;

COMMIT;
