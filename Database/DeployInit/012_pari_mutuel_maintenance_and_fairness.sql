-- ============================================================================
-- Migration: 012_pari_mutuel_maintenance_and_fairness.sql
-- Description: 浮动彩池（Pari-Mutuel）稀释赔率、系统停机维护窗口、
--              Provably Fair 承诺时序、异常取消退款与规费返佣费率调整：
--              1. race_rule_configs 扩展维护时间窗口、单轮最大赔付限额与返佣基准比例
--              2. race_rounds 扩展浮动彩池赔付池容量与本轮稀释因子
--              3. bet_orders 扩展中奖稀释因子与取消退款流水关联
--              4. 更新默认规费区间为千分之10 (1.0%) ~ 百分之2 (2.0%)
-- ============================================================================

-- 1. race_rule_configs 扩展字段
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS maintenance_start_at TIMESTAMPTZ;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS maintenance_end_at TIMESTAMPTZ;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS is_maintenance_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS maintenance_notice_minutes INT NOT NULL DEFAULT 30;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS maintenance_reason VARCHAR(256);
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS max_round_payout_liability NUMERIC(20, 2) NOT NULL DEFAULT 500000.00;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS referral_commission_rate NUMERIC(10, 6) NOT NULL DEFAULT 0.005000;

COMMENT ON COLUMN race_rule_configs.maintenance_start_at IS '计划系统维护开始时间 (UTC)';
COMMENT ON COLUMN race_rule_configs.maintenance_end_at IS '计划系统维护结束时间 (UTC)';
COMMENT ON COLUMN race_rule_configs.is_maintenance_enabled IS '是否启用维护窗口拦截';
COMMENT ON COLUMN race_rule_configs.maintenance_notice_minutes IS '维护开始前多少分钟向客户端弹出预警提示';
COMMENT ON COLUMN race_rule_configs.maintenance_reason IS '系统停机维护原因说明';
COMMENT ON COLUMN race_rule_configs.max_round_payout_liability IS '单轮比赛最大总赔付限额（用于浮动彩池稀释赔率控制）';
COMMENT ON COLUMN race_rule_configs.referral_commission_rate IS '下级负盈利返佣固定比例（默认千分之5即 0.5%）';

-- 2. race_rounds 扩展字段
ALTER TABLE race_rounds ADD COLUMN IF NOT EXISTS payout_pool_amount NUMERIC(20, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE race_rounds ADD COLUMN IF NOT EXISTS dilution_factor NUMERIC(10, 6) NOT NULL DEFAULT 1.000000;

COMMENT ON COLUMN race_rounds.payout_pool_amount IS '当轮浮动彩池可赔付金额容量';
COMMENT ON COLUMN race_rounds.dilution_factor IS '当轮赔率稀释因子（<= 1.0，1.0 代表无需稀释）';

-- 3. bet_orders 扩展字段
ALTER TABLE bet_orders ADD COLUMN IF NOT EXISTS dilution_factor NUMERIC(10, 6) NOT NULL DEFAULT 1.000000;
ALTER TABLE bet_orders ADD COLUMN IF NOT EXISTS refund_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL;

COMMENT ON COLUMN bet_orders.dilution_factor IS '该注单结算时实际执行的赔率稀释因子';
COMMENT ON COLUMN bet_orders.refund_transaction_id IS '赛事取消退款对应的钱包流水 ID';

-- 4. 更新默认规则配置的规费阶梯（千分之10 到 百分之2）与返佣比例（千分之5）
UPDATE race_rule_configs
SET fee_schedule_json = '[{"maximumGrossReward":10000.00,"rate":0.010},{"maximumGrossReward":50000.00,"rate":0.012},{"maximumGrossReward":100000.00,"rate":0.015},{"maximumGrossReward":null,"rate":0.020}]'::jsonb,
    referral_commission_rate = 0.005000,
    updated_at = NOW()
WHERE config_code IN ('default', 'DEFAULT_RULES');
