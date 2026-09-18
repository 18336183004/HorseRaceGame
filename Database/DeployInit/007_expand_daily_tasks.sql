-- ============================================================================
-- Migration: 007_expand_daily_tasks.sql
-- Description: 依据 PRD 6.10 规范，扩充并对齐完整的 9 个每日任务定义
--              比赛场数（3、10、20）、比赛胜场（1、3、5）、比赛负场（1、3、5）
-- ============================================================================

INSERT INTO daily_task_definitions (
    task_code,
    task_type,
    title_zh,
    title_en,
    description_zh,
    description_en,
    target_value,
    condition_payload_json,
    reward_type,
    reward_payload,
    version,
    is_enabled,
    sort_order,
    created_at,
    updated_at
)
VALUES
    -- 1. 比赛场数任务 (3, 10, 20)
    ('DAILY_RACE_COUNT_3', 'RACE_COUNT', '累计完成3场比赛', 'Complete 3 Races', '当天累计参与并结算3场比赛。', 'Participate in and settle 3 races during the business day.', 3, '{"metric":"settledRaceCount"}'::JSONB, 'COIN', '{"amount":150}'::JSONB, 1, TRUE, 10, NOW(), NOW()),
    ('DAILY_RACE_COUNT_10', 'RACE_COUNT', '累计完成10场比赛', 'Complete 10 Races', '当天累计参与并结算10场比赛。', 'Participate in and settle 10 races during the business day.', 10, '{"metric":"settledRaceCount"}'::JSONB, 'COIN', '{"amount":400}'::JSONB, 1, TRUE, 20, NOW(), NOW()),
    ('DAILY_RACE_COUNT_20', 'RACE_COUNT', '累计完成20场比赛', 'Complete 20 Races', '当天累计参与并结算20场比赛。', 'Participate in and settle 20 races during the business day.', 20, '{"metric":"settledRaceCount"}'::JSONB, 'COIN', '{"amount":1000}'::JSONB, 1, TRUE, 30, NOW(), NOW()),

    -- 2. 比赛胜场任务 (1, 3, 5)
    ('DAILY_RACE_WIN_1', 'RACE_WIN', '赢得1场比赛', 'Win 1 Race', '当天在任意一场已结算比赛中获胜。', 'Win any settled race during the business day.', 1, '{"metric":"settledRaceWinCount"}'::JSONB, 'COIN', '{"amount":200}'::JSONB, 1, TRUE, 40, NOW(), NOW()),
    ('DAILY_RACE_WIN_3', 'RACE_WIN', '累计赢得3场比赛', 'Win 3 Races', '当天累计在3场已结算比赛中获胜。', 'Win 3 settled races during the business day.', 3, '{"metric":"settledRaceWinCount"}'::JSONB, 'COIN', '{"amount":500}'::JSONB, 1, TRUE, 50, NOW(), NOW()),
    ('DAILY_RACE_WIN_5', 'RACE_WIN', '累计赢得5场比赛', 'Win 5 Races', '当天累计在5场已结算比赛中获胜。', 'Win 5 settled races during the business day.', 5, '{"metric":"settledRaceWinCount"}'::JSONB, 'COIN', '{"amount":1200}'::JSONB, 1, TRUE, 60, NOW(), NOW()),

    -- 3. 比赛负场任务 (1, 3, 5)
    ('DAILY_RACE_LOSS_1', 'RACE_LOSS', '完成1场未获胜比赛', 'Complete 1 Losing Race', '当天参与一场已结算但未获胜的比赛。', 'Complete one settled race without winning during the business day.', 1, '{"metric":"settledRaceLossCount"}'::JSONB, 'COIN', '{"amount":80}'::JSONB, 1, TRUE, 70, NOW(), NOW()),
    ('DAILY_RACE_LOSS_3', 'RACE_LOSS', '累计3场未获胜比赛', 'Complete 3 Losing Races', '当天累计参与3场已结算但未获胜的比赛。', 'Complete 3 settled races without winning during the business day.', 3, '{"metric":"settledRaceLossCount"}'::JSONB, 'COIN', '{"amount":200}'::JSONB, 1, TRUE, 80, NOW(), NOW()),
    ('DAILY_RACE_LOSS_5', 'RACE_LOSS', '累计5场未获胜比赛', 'Complete 5 Losing Races', '当天累计参与5场已结算但未获胜的比赛。', 'Complete 5 settled races without winning during the business day.', 5, '{"metric":"settledRaceLossCount"}'::JSONB, 'COIN', '{"amount":400}'::JSONB, 1, TRUE, 90, NOW(), NOW())
ON CONFLICT (task_code) DO UPDATE SET
    task_type = EXCLUDED.task_type,
    title_zh = EXCLUDED.title_zh,
    title_en = EXCLUDED.title_en,
    description_zh = EXCLUDED.description_zh,
    description_en = EXCLUDED.description_en,
    target_value = EXCLUDED.target_value,
    condition_payload_json = EXCLUDED.condition_payload_json,
    reward_type = EXCLUDED.reward_type,
    reward_payload = EXCLUDED.reward_payload,
    version = EXCLUDED.version,
    is_enabled = EXCLUDED.is_enabled,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();
