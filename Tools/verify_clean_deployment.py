import re

def verify_all():
    with open('Database/DeployInit/001_schema.sql', 'r', encoding='utf-8') as f:
        s1 = f.read()

    tables = re.findall(r'CREATE TABLE IF NOT EXISTS ([a-zA-Z0-9_]+)', s1)
    print(f'Total tables created in 001_schema.sql: {len(tables)}, unique: {len(set(tables))}')
    if len(tables) != 74 or len(set(tables)) != 74:
        raise ValueError(f'Expected 74 unique tables, found {len(tables)} (unique: {len(set(tables))})')

    with open('Database/DeployInit/002_seed_data.sql', 'r', encoding='utf-8') as f:
        s2 = f.read()

    # Count horses
    horses = re.findall(r"'HORSE_[A-Z_]+'", s2)
    print(f'Horse codes in 002: {len(horses)}')
    if len(horses) != 20:
        raise ValueError(f'Expected 20 horses, found {len(horses)}')

    # Count foals
    foals = re.findall(r"'#FOAL-2026-\d{4}'", s2)
    print(f'Foal codes in 002: {len(foals)}')
    if len(foals) != 40:
        raise ValueError(f'Expected 40 foals, found {len(foals)}')

    # Count environments
    envs = re.findall(r"'(?:WEATHER|TRACK)',\s*'([A-Z_]+)'", s2)
    print(f'Environments in 002: {len(envs)} -> {envs}')
    if len(envs) != 6:
        raise ValueError(f'Expected 6 environments, found {len(envs)}')

    # Count commentary templates
    comms = re.findall(r"'(?:START|TURN|STRETCH|FINISH)',\s*(?:NULL|'[^']+'),\s*(?:TRUE|FALSE),\s*\d+", s2)
    print(f'Commentary templates in 002: {len(comms)}')
    if len(comms) != 7:
        raise ValueError(f'Expected 7 commentary templates, found {len(comms)}')

    # Count tipsters
    tips = re.findall(r"'(?:BOTH|TRACK_ONLY|WEATHER_ONLY|DEFAULT)',\s*\d+,\s*\d+", s2)
    print(f'Tipsters in 002: {len(tips)}')
    if len(tips) != 4:
        raise ValueError(f'Expected 4 tipsters, found {len(tips)}')

    # Count foal tiers
    tiers = re.findall(r"'(?:WILD|PLAINS_TB|ROYAL|MYTHIC)'", s2)
    print(f'Tiers in 002: {len(tiers)}')

    # Count feeds
    feeds = re.findall(r"'FEED_[A-Z_]+'", s2)
    print(f'Feeds in 002: {len(feeds)}')
    if len(feeds) != 4:
        raise ValueError(f'Expected 4 feeds, found {len(feeds)}')

    # Count training catalogs
    trainings = re.findall(r"'(?:SPRINT|LOPE|CORNER|HILL)'", s2)
    print(f'Training catalogs in 002: {len(trainings)}')

    # Count care catalogs
    cares = re.findall(r"'(?:GROOM|HANDWALK|FARRIER|PROBIOTIC|PHYSIOMUD)'", s2)
    print(f'Care catalogs in 002: {len(cares)}')

    # Count daily tasks
    tasks = set(re.findall(r"'DAILY_RACE_[A-Z0-9_]+'", s2))
    print(f'Unique daily task codes in 002: {len(tasks)} -> {tasks}')
    if len(tasks) != 9:
        raise ValueError(f'Expected 9 daily tasks, found {len(tasks)}')

    # Count achievements
    achvs = re.findall(r"'ACHV_[A-Z0-9_]+'", s2)
    print(f'Achievement definitions in 002: {len(achvs)}')
    if len(achvs) != 10:
        raise ValueError(f'Expected 10 achievements, found {len(achvs)}')

    # Count jackpot pools
    jackpots = re.findall(r"'MEGA_COIN_POOL'", s2)
    print(f'Jackpot pools in 002: {len(jackpots)}')
    if len(jackpots) == 0:
        raise ValueError('Expected jackpot pool in 002')

    # Count ranch equipment items
    equip = re.findall(r"'SAD_[A-Z0-9_]+'|'STP_[A-Z0-9_]+'|'SHU_[A-Z0-9_]+'", s2)
    print(f'Ranch equipment items in 002: {len(equip)}')
    if len(equip) != 5:
        raise ValueError(f'Expected 5 equipment items, found {len(equip)}')

    # Count shop products
    products = re.findall(r"'SHOP_[A-Z0-9_]+'", s2)
    print(f'Shop products in 002: {len(products)}')
    if len(products) != 14:
        raise ValueError(f'Expected 14 shop products, found {len(products)}')

    print('ALL DEPLOYMENT VERIFICATIONS PASSED 100%!')

if __name__ == '__main__':
    verify_all()
