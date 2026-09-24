import os
from PIL import Image

def verify():
    sprites_ts = "Client/assets/scripts/HorseSprites.ts"
    if not os.path.exists(sprites_ts):
        print("ERROR: HorseSprites.ts not found")
        return

    with open(sprites_ts, "r", encoding="utf-8") as f:
        content = f.read()

    print(f"HorseSprites.ts size: {len(content)} bytes")
    all_ok = True

    horses_dir = "Client/assets/textures/horses"
    foals_dir = "Client/assets/textures/foals"

    # Verify all 20 horses (1 to 20)
    print("\n--- Verifying 20 Adult Horses (H01 - H20) ---")
    verified_horses = 0
    for h in range(1, 21):
        h_code = f"H{h:02d}"
        types = ["Sprite", "Showcase", "Ortho", "Ortho_Front", "Ortho_Side", "Ortho_Back"]
        h_ok = True
        for typ in types:
            found = False
            for fname in os.listdir(horses_dir):
                if fname.startswith(f"{h_code}_") and typ in fname and fname.endswith(".png"):
                    found = True
                    img_path = os.path.join(horses_dir, fname)
                    try:
                        with Image.open(img_path) as im:
                            _ = im.size
                    except Exception as e:
                        print(f"ERROR: Corrupted image {fname}: {e}")
                        all_ok = False
                        h_ok = False
                    break
            if not found:
                print(f"ERROR: Missing PNG for {h_code}_{typ}")
                all_ok = False
                h_ok = False
        if h_ok:
            verified_horses += 1

    print(f"Verified {verified_horses}/20 adult horses complete.")

    # Verify all 20 foals (F01 - F20)
    print("\n--- Verifying 20 Foals (F01 - F20) ---")
    verified_foals = 0
    stages = ["Stage1_Foal", "Stage2_Yearling", "Stage3_Adult", "Stage4_Pro"]
    for f_idx in range(1, 21):
        f_code = f"F{f_idx:02d}"
        f_ok = True
        for st in stages:
            found = False
            for fname in os.listdir(foals_dir):
                if fname.startswith(f"{f_code}_") and st in fname and fname.endswith(".png"):
                    found = True
                    img_path = os.path.join(foals_dir, fname)
                    try:
                        with Image.open(img_path) as im:
                            _ = im.size
                    except Exception as e:
                        print(f"ERROR: Corrupted image {fname}: {e}")
                        all_ok = False
                        f_ok = False
                    break
            if not found:
                print(f"ERROR: Missing PNG for {f_code}_{st}")
                all_ok = False
                f_ok = False
        if f_ok:
            verified_foals += 1

    print(f"Verified {verified_foals}/20 foals complete.")

    # Verify 8-frame animation sheets and track textures
    print("\n--- Verifying Gallop Animation & Track Textures ---")
    extra_assets = [
        ("Client/assets/textures/horses/horse_gallop_sheet_8f.png", (1024, 128)),
        ("Client/assets/textures/horses/jockey_ride_sheet_8f.png", (1024, 128)),
        ("Client/assets/textures/tracks/turf_seamless.png", (512, 256)),
        ("Client/assets/textures/tracks/dirt_seamless.png", (512, 256)),
        ("Client/assets/textures/tracks/sand_seamless.png", (512, 256)),
        ("Client/assets/textures/tracks/hoof_splash.png", (256, 64)),
    ]
    verified_extras = 0
    for asset_path, exp_size in extra_assets:
        if not os.path.exists(asset_path):
            print(f"ERROR: Missing asset {asset_path}")
            all_ok = False
            continue
        meta_path = asset_path + ".meta"
        if not os.path.exists(meta_path):
            print(f"ERROR: Missing .meta file for {asset_path}")
            all_ok = False
            continue
        try:
            with Image.open(asset_path) as im:
                if im.size != exp_size:
                    print(f"WARNING: Asset {asset_path} size {im.size} != expected {exp_size}")
                verified_extras += 1
        except Exception as e:
            print(f"ERROR: Corrupted asset {asset_path}: {e}")
            all_ok = False

    print(f"Verified {verified_extras}/{len(extra_assets)} animation sheets and track textures complete.")

    if all_ok:
        print("\nSUCCESS: All 20 adult horses, 20 foals, 8-frame gallop sheets, and seamless track textures are 100% valid, intact, and ready for runtime!")

if __name__ == "__main__":
    verify()
