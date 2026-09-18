from pathlib import Path
import re, sys
root=Path(__file__).resolve().parents[1]
checks=[]
def ck(name, ok):
    checks.append((name,bool(ok))); print(f"{name}: {'PASS' if ok else 'FAIL'}")
api=(root/'Server/RaceGame.Api/Program.cs').read_text(encoding='utf-8')
admin=(root/'Server/RaceGame.Admin/Program.cs').read_text(encoding='utf-8')
sln=(root/'RaceGame.sln').read_text(encoding='utf-8')
settings=(root/'Server/RaceGame.Admin/appsettings.json').read_text(encoding='utf-8')
ck('admin project in solution', 'RaceGame.Admin' in sln)
ck('api file logging', 'DailyFileLoggerProvider' in api and 'logs", "api' in api)
ck('admin file logging', 'DailyFileLoggerProvider' in admin and 'logs", "admin' in admin)
ck('api has no admin controllers', not (root/'Server/RaceGame.Api/Controllers/AdminController.cs').exists())
ck('admin mvc', 'AddControllersWithViews' in admin and 'MapControllerRoute' in admin)
ck('admin auth cookie', 'AddCookie' in admin and 'UseAuthentication' in admin)
ck('postgres database', 'Database=postgres' in settings)
seed=(root/'Database/DeployInit/003_seed_default_race_rules.sql').read_text(encoding='utf-8')
ck('admin seed account', "INSERT INTO admin_users" in seed and "'ADMIN'" in seed and 'PBKDF2-SHA256-100000' in seed)
ck('admin db authentication', 'db.AdminUsers' in (root/'Server/RaceGame.Admin/Controllers/AccountController.cs').read_text(encoding='utf-8') and 'AdminPasswordHasher' in (root/'Server/RaceGame.Admin/Controllers/AccountController.cs').read_text(encoding='utf-8'))
ck('no admin auto migrate', '.Migrate(' not in admin and 'EnsureCreated' not in admin)
ck('admin health', 'MapGet("/health"' in admin)
for name in ['Home','Players','Rounds','Bets','Horses','RaceRules','Logs','Account']:
    ck(f'admin controller {name}', (root/f'Server/RaceGame.Admin/Controllers/{name}Controller.cs').exists())
ck('vue3 ui', 'vue@3' in (root/'Server/RaceGame.Admin/Views/Shared/_Layout.cshtml').read_text(encoding='utf-8'))
ck('bootstrap5 ui', 'bootstrap@5' in (root/'Server/RaceGame.Admin/Views/Shared/_Layout.cshtml').read_text(encoding='utf-8'))
# simple C# structural check: braces balanced after removing strings/comments approximately
for f in list((root/'Server/RaceGame.Admin').rglob('*.cs')) + [root/'Server/RaceGame.Api/Program.cs']:
    t=f.read_text(encoding='utf-8')
    ck(f'brace {f.relative_to(root)}', t.count('{')==t.count('}'))
if not all(ok for _,ok in checks): sys.exit(1)
print('SELF_VERIFY_V1.4.4 PASS')
