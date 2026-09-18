# 《街机经典黄金赛马（连赢 Quinella）API 契约与通信规范》

## 一、 概述

本文档规定街机经典连赢赛马模式下的客户端与服务端 HTTP/SignalR 数据传输契约。新契约与原有单马独赢（WIN）完全保持向后兼容。

---

## 二、 HTTP 接口变更与扩展

### 2.1 查询当前轮次信息
- **请求路径**：`GET /api/race/current`
- **响应体数据扩展**：
```json
{
  "code": 0,
  "data": {
    "id": 1024,
    "roundNo": "R202609140001",
    "state": 1,
    "winnerHorseNo": null,
    "secondHorseNo": null,
    "quinellaOdds": [
      { "combination": "1-2", "horse1": 1, "horse2": 2, "odds": 20.0 },
      { "combination": "1-3", "horse1": 1, "horse2": 3, "odds": 50.0 },
      { "combination": "1-4", "horse1": 1, "horse2": 4, "odds": 80.0 },
      { "combination": "1-5", "horse1": 1, "horse2": 5, "odds": 120.0 },
      { "combination": "1-6", "horse1": 1, "horse2": 6, "odds": 175.0 },
      { "combination": "2-3", "horse1": 2, "horse2": 3, "odds": 8.0 },
      { "combination": "2-4", "horse1": 2, "horse2": 4, "odds": 4.0 },
      { "combination": "2-5", "horse1": 2, "horse2": 5, "odds": 30.0 },
      { "combination": "2-6", "horse1": 2, "horse2": 6, "odds": 60.0 },
      { "combination": "3-4", "horse1": 3, "horse2": 4, "odds": 10.0 },
      { "combination": "3-5", "horse1": 3, "horse2": 5, "odds": 80.0 },
      { "combination": "3-6", "horse1": 3, "horse2": 6, "odds": 100.0 },
      { "combination": "4-5", "horse1": 4, "horse2": 5, "odds": 250.0 },
      { "combination": "4-6", "horse1": 4, "horse2": 6, "odds": 500.0 },
      { "combination": "5-6", "horse1": 5, "horse2": 6, "odds": 1000.0 }
    ],
    "horses": [
      { "horseNo": 1, "odds": 3.5, "winRate": 0.18, ... }
    ]
  }
}
```

### 2.2 提交连赢投注订单
- **请求路径**：`POST /api/race/bet`
- **请求体格式**：
```json
{
  "roundId": 1024,
  "playType": "QUINELLA",
  "combination": "2-4",
  "horseNo": 2,
  "secondHorseNo": 4,
  "amount": 100.0,
  "idempotencyKey": "bet:quinella:1024:uuid123"
}
```
- **字段说明**：
  - `playType`: 可选，`"WIN"`（默认单马独赢）或 `"QUINELLA"`（连赢组合）；
  - `combination`: 选填，形如 `"2-4"`；若传递则自动规范化为两马升序；
  - `horseNo`: 组合第一匹马（或单马独赢马号）；
  - `secondHorseNo`: 连赢模式下第二匹马（必须在 1~6 且不等于 `horseNo`）；
  - `amount`: 投注金额；
  - `idempotencyKey`: 客户端生成的全局唯一幂等键。

- **成功响应示例**：
```json
{
  "code": 0,
  "data": {
    "orderNo": "ORD202609140001",
    "playerId": 1001,
    "roundId": 1024,
    "playType": "QUINELLA",
    "combination": "2-4",
    "horseNo": 2,
    "secondHorseNo": 4,
    "betAmount": 100.0,
    "lockedOdds": 4.0,
    "grossReward": 400.0,
    "feeRate": 0.0005,
    "feeAmount": 0.20,
    "netReward": 399.80,
    "balance": 9900.0,
    "serverTime": "2026-09-14T10:00:00Z"
  }
}
```

### 2.3 查询我的本轮注单与连赢记录
- **请求路径**：`GET /api/race/{roundId}/my-bets`
- **响应体数据**：
```json
{
  "code": 0,
  "data": {
    "horseNo": 2,
    "playType": "QUINELLA",
    "secondHorseNo": 4,
    "combination": "2-4",
    "totalAmount": 100.0,
    "orders": [
      {
        "orderNo": "ORD202609140001",
        "playType": "QUINELLA",
        "horseNo": 2,
        "secondHorseNo": 4,
        "combination": "2-4",
        "betAmount": 100.0,
        "lockedOdds": 4.0,
        "netReward": 399.80,
        "status": 1
      }
    ]
  }
}
```

### 2.4 查询玩家历史注单与详情钻取
- **请求路径**：`GET /api/player/bets?page=1&pageSize=20` 与 `GET /api/player/bets/{orderNo}`
- **响应体数据**：包含 `playType`、`secondHorseNo`、`combination`、`statusReason`（`"WIN"` / `"WIN_JACKPOT"` / `"LOSE"`），以及关联比赛 `race` 的 `winnerHorseNo`、`secondHorseNo`、`quinellaCombination`，便于客户端复盘展示。
- **街机大爆奖标识 (`WIN_JACKPOT`)**：当连赢注单命中且前两名中包含黑马（`IsBlackHorse`）时，该注单获得额外 +25% 爆机赏金加成，`statusReason` 返回 `"WIN_JACKPOT"`。

---

## 三、 SignalR 实时广播通知

比赛结束时，`RaceSettled` 事件下发完整赛果，包含冠军、亚军与连赢中奖组合：
```json
{
  "eventName": "RaceSettled",
  "roundId": 1024,
  "roundNo": "R202609140001",
  "winnerHorseNo": 2,
  "secondHorseNo": 4,
  "quinellaCombination": "2-4",
  "settlementAt": "2026-09-14T10:01:00Z"
}
```
