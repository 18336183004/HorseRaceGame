# RaceGame.Admin

独立管理后台，不向游戏客户端暴露管理控制器。

- 技术栈：ASP.NET Core 10 MVC / Razor / Bootstrap 5 / Vue 3 渐进增强
- HTTPS：`https://localhost:55329/`
- Health：`https://localhost:55329/health`
- 数据库：PostgreSQL `postgres`
- 登录账号由 `003_seed_default_race_rules.sql` 初始化：`admin / RaceGame@2026`
- 日志：项目根目录 `logs/admin/admin-YYYYMMDD.log`

首次导入或重置数据库必须顺序执行 001、002、003 SQL。
