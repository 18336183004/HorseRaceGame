-- RaceGame V2.0：幂等请求指纹。
-- 不修改历史迁移；旧订单允许 NULL，新订单由应用写入 SHA-256 指纹。
ALTER TABLE bet_orders ADD COLUMN IF NOT EXISTS request_hash VARCHAR(64);
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS request_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_bet_orders_player_created_at
    ON bet_orders (player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shop_orders_player_created_at
    ON shop_orders (player_id, created_at DESC);

-- 禁用历史迁移中仅用于本地开发的固定管理员凭据。
UPDATE admin_users
SET is_active = FALSE, updated_at = NOW()
WHERE username_normalized = 'ADMIN';
