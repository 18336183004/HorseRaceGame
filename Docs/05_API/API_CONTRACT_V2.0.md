# RaceGame API 合同 V2.0

## 认证

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`
- `POST /api/auth/dev-login` 仅 Development/Test

## 比赛

- `GET /api/race/current`
- `GET /api/race/time`
- `GET /api/race/history?limit=8`
- `GET /api/race/{id}`
- `GET /api/race/{id}/animation`
- `GET /api/race/{id}/result`
- `GET /api/race/{id}/my-bets`
- `POST /api/race/bet`

## 玩家/钱包

- `GET /api/player/me`
- `GET /api/player/bets`
- `GET /api/player/bets/{orderNo}`
- `GET /api/wallet`
- `GET /api/wallet/transactions`

## 内容

- `GET /api/stable/horses`
- `GET /api/stable/horses/{id}`
- `GET /api/characters`
- `PUT /api/player/character`
- `GET /api/player/assets`
- `GET /api/tasks/daily`
- `POST /api/tasks/daily/{id}/claim`
- `GET /api/leaderboards/players`
- `GET /api/leaderboards/horses`
- `GET /api/shop/products`
- `POST /api/shop/orders`
- `GET /api/notices/active`
- `POST /api/notices/{id}/read`
- `GET/PUT /api/player/settings`

## 响应

成功：`{ code: 0, data: ... }`

业务失败：非 0 code + message，并使用匹配的 HTTP 状态码。
