from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []
checks = []

def require(condition, message):
    checks.append(message)
    if not condition:
        errors.append(message)

# Documents
required_docs = [
    'Docs/00_Product/PRODUCT_BIBLE_V2.0.md',
    'Docs/01_Architecture/ARCHITECTURE_V2.0.md',
    'Docs/02_Requirements/PRODUCT_REQUIREMENTS_V2.0.md',
    'Docs/03_Plans/V2.0_IMPLEMENTATION_PLAN.md',
    'Docs/04_Data/DATA_CONTRACT_V2.0.md',
    'Docs/05_API/API_CONTRACT_V2.0.md',
    'Docs/06_Operations/RELEASE_RUNBOOK_V2.0.md',
    'Docs/07_QA/RELEASE_READINESS_V2.0.md',
    'Docs/09_Prototype/PROTOTYPE_MAPPING_V2.0.md',
]
for doc in required_docs:
    require((ROOT / doc).exists(), f'doc exists: {doc}')

# Version / client
client_config = (ROOT / 'Client/assets/scripts/ClientConfig.ts').read_text(encoding='utf-8')
project_json = (ROOT / 'Client/project.json').read_text(encoding='utf-8')
version = (ROOT / 'VERSION.txt').read_text(encoding='utf-8')
require('"version": "3.8.8"' in project_json, 'Cocos Creator 3.8.8')
require('clientVersion ?? "2.0.0"' in client_config, 'client version 2.0.0')
require('RaceGame V2.0.0' in version, 'release version 2.0.0')

# Database contract
deploy_006 = (ROOT / 'Database/DeployInit/006_v2_hardening.sql').read_text(encoding='utf-8')
require('ADD COLUMN IF NOT EXISTS request_hash' in deploy_006, 'request_hash deploy init')
require('UPDATE admin_users' in deploy_006 and "username_normalized = 'ADMIN'" in deploy_006, 'historical default admin disabled')
deploy_007 = (ROOT / 'Database/DeployInit/007_expand_daily_tasks.sql').read_text(encoding='utf-8')
require('DAILY_RACE_COUNT_3' in deploy_007 and 'DAILY_RACE_WIN_5' in deploy_007 and 'DAILY_RACE_LOSS_5' in deploy_007, '007 deploy init defines 9 daily tasks')
require('DAILY_RACE_COUNT_20' in deploy_007, '007 deploy init contains DAILY_RACE_COUNT_20')

# Domain/Application request hash wiring
bet_entity = (ROOT / 'Server/RaceGame.Domain/Entities/BetOrder.cs').read_text(encoding='utf-8')
shop_entity = (ROOT / 'Server/RaceGame.Domain/Entities/ShopOrder.cs').read_text(encoding='utf-8')
bet_service = (ROOT / 'Server/RaceGame.Application/Betting/BettingService.cs').read_text(encoding='utf-8')
shop_service = (ROOT / 'Server/RaceGame.Application/Shop/ShopService.cs').read_text(encoding='utf-8')
require('RequestHash' in bet_entity and 'RequestHash = requestHash' in bet_service, 'bet request fingerprint end-to-end')
require('RequestHash' in shop_entity and 'RequestHash = requestHash' in shop_service, 'shop request fingerprint end-to-end')
require('IDEMPOTENCY_REQUEST_MISMATCH' in bet_service, 'bet idempotency mismatch rejection')
require('IDEMPOTENCY_REQUEST_MISMATCH' in shop_service, 'shop idempotency mismatch rejection')

# Auth
auth = (ROOT / 'Server/RaceGame.Api/Controllers/AuthController.cs').read_text(encoding='utf-8')
require('[HttpPost("logout")]' in auth, 'server logout endpoint')
require('FailedLoginCount >= 5' in auth and 'AddMinutes(10)' in auth, 'login lockout policy')
require('[HttpPost("dev-login")]' in auth, 'dev-login endpoint still present for Development/Test')

# Race history
race_controller = (ROOT / 'Server/RaceGame.Api/Controllers/RaceController.cs').read_text(encoding='utf-8')
require('[HttpGet("history")]' in race_controller, 'race history endpoint')
require('/api/race/history?limit=8' in (ROOT / 'Client/assets/scripts/GameApp.ts').read_text(encoding='utf-8'), 'client consumes server race history')

# Client fake-feature removal
client = (ROOT / 'Client/assets/scripts/GameApp.ts').read_text(encoding='utf-8')
for forbidden in ['USDT-TRC20', 'BNB-BEP20', 'OKX Connect Wallet', 't.me/racegame_bot', '转赠已提交', 'v1.1.1', '?? 10001']:
    require(forbidden not in client, f'no fake/legacy client token: {forbidden}')
require('private async buildWallet' in client, 'wallet ledger page')
require('ApiClient.logout()' in client, 'client server logout')
require('recentWinners: number[] = []' in client, 'no hardcoded recent winners')

# Production security configuration
prod = (ROOT / 'Server/RaceGame.Api/appsettings.Production.json').read_text(encoding='utf-8')
require('"Key": ""' in prod, 'production JWT secret not committed')
require('"Password": ""' in prod, 'production Redis password not committed')
require('"Default": ""' in prod, 'production DB connection not committed')
admin_settings = (ROOT / 'Server/RaceGame.Admin/appsettings.json').read_text(encoding='utf-8')
require('"Default": ""' in admin_settings, 'admin DB connection not committed')

# Deployment
compose = (ROOT / 'deploy/docker-compose.yml').read_text(encoding='utf-8')
for service in ['postgres:', 'redis:', 'api:', 'admin:']:
    require(service in compose, f'docker service {service[:-1]}')
require('condition: service_healthy' in compose, 'docker startup health ordering')
deploy_seed_file = ROOT / 'Database/DeployInit/003_seed_default_race_rules.sql'
if not deploy_seed_file.exists():
    deploy_seed_file = ROOT / 'Database/DeployInit/003_seed_content.sql'
require(deploy_seed_file.exists() and len(deploy_seed_file.read_text(encoding='utf-8')) > 0, 'deploy init seed file exists and non-empty')

# API security anti-regressions
program = (ROOT / 'Server/RaceGame.Api/Program.cs').read_text(encoding='utf-8')
require('AllowAnyOrigin' not in program, 'no AllowAnyOrigin')
require('AllowCredentials' in program, 'credentialed CORS explicit')

print(f'VERIFY_V2 checks={len(checks)} errors={len(errors)}')
if errors:
    for error in errors:
        print('FAIL:', error)
    sys.exit(1)
print('VERIFY_V2 PASS')
