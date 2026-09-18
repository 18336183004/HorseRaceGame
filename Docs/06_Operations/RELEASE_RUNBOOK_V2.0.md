# RaceGame 发布运行手册 V2.0

## 1. 发布前

- 检查 `VERSION.txt` 与 `ClientConfig.clientVersion`；
- 检查数据库备份；
- 检查环境变量；
- 检查 CORS；
- 检查 Swagger 仅 Development；
- 检查 dev-login 未开放；
- 检查日志目录可写；
- 检查 Redis/PostgreSQL 健康；
- 执行数据库迁移；
- 执行自动化测试。

## 2. 发布顺序

`PostgreSQL → Redis → API/Worker → Admin → Cocos 客户端`

API/Worker 启动后必须存在唯一 Betting 轮次。

## 3. 灰度观察

重点监控：

- 轮次创建失败；
- Worker 锁续租失败；
- 下注失败率；
- 钱包事务冲突；
- 结算失败/重试；
- SignalR 连接与重连；
- API P95/P99；
- PostgreSQL 连接池；
- Redis 延迟；
- 异常登录/锁定次数。

## 4. 回滚

代码回滚不能直接回滚已执行的数据库迁移。先停 Worker，确保没有活动结算，再按兼容策略回滚应用；数据库采用前向兼容迁移或恢复备份。
