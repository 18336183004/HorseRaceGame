import os
import re
import json

def audit():
    print("=== 1. Checking Asset Paths in Code ===")
    ts_files = []
    for root, dirs, files in os.walk('Client/assets/scripts'):
        for f in files:
            if f.endswith('.ts'):
                ts_files.append(os.path.join(root, f))

    # Search for all strings matching textures/... or assets/...
    asset_references = set()
    for ts in ts_files:
        with open(ts, 'r', encoding='utf-8') as f:
            content = f.read()
        # Find paths starting with textures/
        matches = re.findall(r'["\'](textures/[^"\']+)["\']', content)
        for m in matches:
            asset_references.add((m, ts))

    print(f"Found {len(asset_references)} texture path references across scripts.")
    missing_assets = []
    for ref, src in sorted(asset_references):
        clean_ref = ref
        if clean_ref.endswith('/'):
            continue
        if not (clean_ref.endswith('.png') or clean_ref.endswith('.jpg') or clean_ref.endswith('.jpeg')):
            # might have .png appended in runtime
            clean_ref_png = clean_ref + '.png'
            clean_ref_jpg = clean_ref + '.jpg'
            p_png = os.path.join('Client/assets', clean_ref_png)
            p_jpg = os.path.join('Client/assets', clean_ref_jpg)
            if not os.path.exists(p_png) and not os.path.exists(p_jpg):
                missing_assets.append((ref, src))
        else:
            p = os.path.join('Client/assets', clean_ref)
            if not os.path.exists(p):
                missing_assets.append((ref, src))

    if missing_assets:
        print(f"WARNING: {len(missing_assets)} missing asset references:")
        for ref, src in missing_assets:
            print(f"  {ref} referenced in {os.path.basename(src)}")
    else:
        print("ALL static texture references in scripts exist on disk!")

    print("\n=== 2. Checking HorseAssetRegistry vs Disk ===")
    with open('Client/assets/scripts/HorseAssetRegistry.ts', 'r', encoding='utf-8') as f:
        har = f.read()

    horses_block = re.findall(r'horseNo:\s*(\d+).*?nameZh:\s*"([^"]+)".*?showcaseUrl:\s*"([^"]+)".*?orthoUrl:\s*"([^"]+)"', har, re.DOTALL)
    print(f"Registered horses in HorseAssetRegistry: {len(horses_block)}")
    for hno, name, sc, ort in horses_block:
        sc_path = os.path.join('Client/assets', sc + '.png')
        ort_path = os.path.join('Client/assets', ort + '.png')
        sc_ok = os.path.exists(sc_path)
        ort_ok = os.path.exists(ort_path)
        if not sc_ok or not ort_ok:
            print(f"  H{int(hno):02d} ({name}): Showcase={sc_ok}, Ortho={ort_ok}")

    print("\n=== 3. Checking Database 002_seed_data.sql vs HorseAssetRegistry ===")
    seed_sql = 'Database/DeployInit/002_seed_data.sql'
    if os.path.exists(seed_sql):
        with open(seed_sql, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        # Find horses inserted into horses table
        # INSERT INTO horses (id, name, ...
        # Or look for H01..H20 or names
        print(f"002_seed_data.sql size: {len(sql_content)} bytes")
        for hno, name, _, _ in horses_block:
            if name in sql_content:
                pass
            else:
                print(f"  Horse {hno} ({name}) not found in seed SQL")
    else:
        print(f"File {seed_sql} not found")

    print("\n=== 4. Checking SignalR Client Events vs Server Hub ===")
    with open('Client/assets/scripts/SignalRClient.ts', 'r', encoding='utf-8') as f:
        sig_content = f.read()

    # Find client registered events: this.connection.on("...", ...)
    client_events = re.findall(r'connection\.on\(["\']([^"\']+)["\']', sig_content)
    print(f"SignalR Client listens to: {client_events}")

    # Check Server Hub emits
    server_emits = []
    for root, dirs, files in os.walk('Server'):
        for f in files:
            if f.endswith('.cs'):
                p = os.path.join(root, f)
                with open(p, 'r', encoding='utf-8') as csf:
                    txt = csf.read()
                matches = re.findall(r'SendAsync\(\s*["\']([^"\']+)["\']', txt)
                for item in matches:
                    server_emits.append((item, f))

    print(f"Server SignalR emits ({len(server_emits)} instances):")
    for e, f in sorted(set(server_emits)):
        print(f"  Event: '{e}' in {f}")

    # Check GameApp listens to:
    with open('Client/assets/scripts/GameApp.ts', 'r', encoding='utf-8') as f:
        gameapp_txt = f.read()

    app_listens = re.findall(r'\.on\(\s*["\']([^"\']+)["\']', gameapp_txt)
    print(f"GameApp SignalR listens to: {set(app_listens)}")

    unhandled_events = set(e for e, f in server_emits) - set(app_listens)
    print(f"Events emitted by server but not handled in client: {unhandled_events}")

    print("\n=== 6. Checking Database Horses vs HorseAssetRegistry ===")
    seed_sql = 'Database/DeployInit/002_seed_data.sql'
    if os.path.exists(seed_sql):
        with open(seed_sql, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        m = re.search(r'INSERT INTO horse_catalogs.*?;', sql_content, re.DOTALL | re.IGNORECASE)
        if m:
            block = m.group(0)
            rows = re.findall(r"\(\s*'([A-Z0-9_]+)',\s*'([^']+)',\s*'([^']+)'", block)
            print(f"Total horses in horse_catalogs: {len(rows)}")
            mismatches = 0
            for idx, (code, zh, en) in enumerate(rows):
                if idx < len(horses_block):
                    reg_no, reg_zh, _, _ = horses_block[idx]
                    if zh != reg_zh:
                        print(f"  MISMATCH H{idx+1:02d}: DB '{zh}' != Registry '{reg_zh}'")
                        mismatches += 1
            if mismatches == 0:
                print("  All 20 horse names in DB match HorseAssetRegistry 100%!")
            else:
                print(f"  Found {mismatches} mismatches!")

        # Check ranch_horses in 002_seed_data.sql
        m_ranch = re.search(r'INSERT INTO ranch_horses.*?;', sql_content, re.DOTALL | re.IGNORECASE)
        if m_ranch:
            ranch_rows = re.findall(r"\(\s*v_player\d*_id,\s*'([^']+)',\s*'([^']+)'", m_ranch.group(0))
            print(f"\nTotal ranch_horses in 002_seed_data.sql: {len(ranch_rows)}")
            for code, name in ranch_rows[:10]:
                print(f"  Ranch horse: {code} - {name}")

    print("\n=== 7. Deep Inspecting HorseGalleryModal.ts ===")
    with open('Client/assets/scripts/HorseGalleryModal.ts', 'r', encoding='utf-8') as f:
        gallery_txt = f.read()

    # Look for node structure and sprite assignment
    print(f"HorseGalleryModal size: {len(gallery_txt)} bytes")
    # Check what methods exist in HorseGalleryModal
    methods = re.findall(r'public\s+([a-zA-Z0-9_]+)\s*\(|private\s+([a-zA-Z0-9_]+)\s*\(', gallery_txt)
    method_names = [m[0] or m[1] for m in methods]
    print(f"Methods in HorseGalleryModal: {method_names}")

    # Check for potential bugs in HorseGalleryModal
    # 1. UITransform sizes
    # 2. Event listeners on buttons
    # 3. Sprite loading

    print("\n=== 8. Deep Inspecting RaceTrack2D.ts ===")
    with open('Client/assets/scripts/RaceTrack2D.ts', 'r', encoding='utf-8') as f:
        track_txt = f.read()
    print(f"RaceTrack2D size: {len(track_txt)} bytes")
    track_methods = [m[0] or m[1] for m in re.findall(r'public\s+([a-zA-Z0-9_]+)\s*\(|private\s+([a-zA-Z0-9_]+)\s*\(', track_txt)]
    print(f"Methods in RaceTrack2D: {track_methods}")

    print("\n=== 9. Deep Inspecting GameApp.ts UI & Logic ===")
    with open('Client/assets/scripts/GameApp.ts', 'r', encoding='utf-8') as f:
        game_lines = f.readlines()
    print(f"GameApp.ts total lines: {len(game_lines)}")

    # Check for null checks, any types, unhandled promises, todo/fixme comments
    todos = []
    for idx, line in enumerate(game_lines):
        if 'TODO' in line or 'FIXME' in line:
            todos.append((idx + 1, line.strip()))
    print(f"Found {len(todos)} TODO/FIXME comments in GameApp.ts:")
    for lno, text in todos[:10]:
        print(f"  Line {lno}: {text}")


if __name__ == '__main__':
    audit()
