# Windows / Docker 启动说明

## 开发环境

- PostgreSQL 16：本地启动后执行 `Database/DeployInit/001~007`。
- Redis 7：`localhost:6379`。开发配置允许 API 自动尝试启动本机 Redis。
- API：`dotnet run --project Server/RaceGame.Api`。
- Admin：`RACEGAME_ADMIN_USERNAME=...` / `RACEGAME_ADMIN_PASSWORD=...` 后再 `dotnet run --project Server/RaceGame.Admin`。
- Cocos：3.8.8。

## Docker

复制 `.env.example` 为 `.env` 并填写：`DB_PASSWORD`、`REDIS_PASSWORD`、`JWT_SECRET_KEY`、`CORS_ORIGIN`。

然后执行：

```powershell
cd deploy
docker compose up -d --build
```

启动依赖：PostgreSQL 健康 → Redis 健康 → API/Worker → Admin。

不要把 `.env` 提交到 Git。
