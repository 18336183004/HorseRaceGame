# RaceGame 上线验收矩阵 V2.0

| 类别 | 验收项 | 通过标准 |
|---|---|---|
| 编译 | API/Worker/Admin | Release build 0 errors |
| Client | Cocos 3.8.8 | TypeScript 0 errors + 场景可运行 |
| 状态机 | 5 分钟轮次 | 时间边界无重复/跳回 |
| 无下注 | Betting 超时 | 不比赛，直接下一轮 |
| 下注 | 同马追加 | 成功 |
| 下注 | 换马 | 拒绝 |
| 幂等 | 相同请求 | 返回同订单 |
| 幂等 | 同键不同参数 | 拒绝 |
| 钱包 | 并发下注 | 无负余额/重复扣款 |
| 结算 | 重试 | 只奖励一次 |
| 赛果 | 重启 | 结果不变 |
| 实时 | 断线 | HTTP 快照补偿 |
| 安全 | dev-login | Production 404 |
| 安全 | CORS | 仅白名单 |
| 安全 | Secret | 不在仓库 |
| 商城 | 金币商品 | 扣款+发货原子完成 |
| UI | 原型 | 核心页面结构对应，按钮均有真实后端能力 |
| 文档 | 代码一致性 | 自动检查 PASS |

当前环境未安装 .NET SDK，因此本次包生成不能宣称通过 .NET Release build；该限制必须在 Windows/.NET 10 CI 中完成最终 RC 验收。
