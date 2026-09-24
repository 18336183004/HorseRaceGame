#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 20 匹成年名驹独有 8 帧奔跑图集与骑师彩衣图集 (H01-H20)
严格对齐 Tools/horse_art_batch/prompts/ 与 GEN_STYLE.md 中的毛色、鬃尾色、白章与骑师彩衣规范。
"""

import json
import math
import os
import sys
import uuid
import numpy as np
from PIL import Image, ImageDraw

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HORSES_DIR = os.path.join(BASE_DIR, "Client", "assets", "textures", "horses")

HORSE_PALETTES = [
    {
        "id": "H01", "name": "CrimsonMeteor", "horseNo": 1,
        "near_coat": (185, 45, 30, 255), "highlight": (220, 85, 55, 255), "far_coat": (135, 30, 20, 255),
        "mane": (225, 120, 30, 255), "hoof": (30, 26, 24, 255), "white_socks": True, "blaze": True,
        "jockey_silk": (185, 38, 26, 255), "jockey_sash": (245, 215, 60, 255), "helmet": (185, 38, 26, 255)
    },
    {
        "id": "H02", "name": "EmeraldWind", "horseNo": 2,
        "near_coat": (195, 202, 208, 255), "highlight": (225, 230, 235, 255), "far_coat": (145, 152, 160, 255),
        "mane": (235, 240, 245, 255), "hoof": (120, 125, 130, 255), "white_socks": False, "blaze": False,
        "jockey_silk": (38, 125, 68, 255), "jockey_sash": (245, 235, 210, 255), "helmet": (38, 125, 68, 255)
    },
    {
        "id": "H03", "name": "GoldenArrow", "horseNo": 3,
        "near_coat": (225, 185, 75, 255), "highlight": (248, 218, 120, 255), "far_coat": (175, 140, 48, 255),
        "mane": (252, 252, 255, 255), "hoof": (70, 58, 42, 255), "white_socks": False, "blaze": False,
        "jockey_silk": (215, 168, 35, 255), "jockey_sash": (45, 45, 55, 255), "helmet": (215, 168, 35, 255)
    },
    {
        "id": "H04", "name": "ShadowHunter", "horseNo": 4,
        "near_coat": (28, 28, 32, 255), "highlight": (60, 60, 68, 255), "far_coat": (16, 16, 20, 255),
        "mane": (15, 15, 18, 255), "hoof": (22, 20, 22, 255), "white_socks": False, "blaze": False,
        "jockey_silk": (35, 35, 45, 255), "jockey_sash": (220, 40, 40, 255), "helmet": (35, 35, 45, 255)
    },
    {
        "id": "H05", "name": "SilverMoon", "horseNo": 5,
        "near_coat": (238, 240, 246, 255), "highlight": (255, 255, 255, 255), "far_coat": (185, 188, 198, 255),
        "mane": (250, 252, 255, 255), "hoof": (135, 140, 150, 255), "white_socks": False, "blaze": False,
        "jockey_silk": (75, 135, 215, 255), "jockey_sash": (245, 245, 250, 255), "helmet": (75, 135, 215, 255)
    },
    {
        "id": "H06", "name": "BlueTide", "horseNo": 6,
        "near_coat": (85, 105, 135, 255), "highlight": (120, 145, 178, 255), "far_coat": (55, 70, 95, 255),
        "mane": (42, 52, 72, 255), "hoof": (35, 42, 55, 255), "white_socks": False, "blaze": False,
        "jockey_silk": (145, 75, 175, 255), "jockey_sash": (235, 210, 60, 255), "helmet": (145, 75, 175, 255)
    },
    {
        "id": "H07", "name": "PurpleLightning", "horseNo": 7,
        "near_coat": (118, 48, 72, 255), "highlight": (155, 70, 98, 255), "far_coat": (78, 28, 48, 255),
        "mane": (72, 22, 42, 255), "hoof": (38, 24, 32, 255), "white_socks": False, "blaze": False,
        "jockey_silk": (225, 95, 40, 255), "jockey_sash": (50, 50, 70, 255), "helmet": (225, 95, 40, 255)
    },
    {
        "id": "H08", "name": "StormRun", "horseNo": 8,
        "near_coat": (128, 70, 40, 255), "highlight": (165, 95, 58, 255), "far_coat": (88, 45, 24, 255),
        "mane": (20, 18, 16, 255), "hoof": (30, 26, 24, 255), "white_socks": True, "blaze": False,
        "jockey_silk": (110, 75, 50, 255), "jockey_sash": (230, 180, 50, 255), "helmet": (110, 75, 50, 255)
    },
    {
        "id": "H09", "name": "ThunderBreak", "horseNo": 9,
        "near_coat": (78, 48, 34, 255), "highlight": (112, 70, 52, 255), "far_coat": (48, 28, 20, 255),
        "mane": (22, 18, 16, 255), "hoof": (28, 24, 22, 255), "white_socks": False, "blaze": True,
        "jockey_silk": (35, 170, 160, 255), "jockey_sash": (245, 245, 245, 255), "helmet": (35, 170, 160, 255)
    },
    {
        "id": "H10", "name": "SunWarrior", "horseNo": 10,
        "near_coat": (168, 42, 32, 255), "highlight": (205, 68, 54, 255), "far_coat": (115, 26, 20, 255),
        "mane": (20, 18, 16, 255), "hoof": (32, 26, 24, 255), "white_socks": False, "blaze": False,
        "jockey_silk": (205, 55, 105, 255), "jockey_sash": (250, 220, 60, 255), "helmet": (205, 55, 105, 255)
    },
    {
        "id": "H11", "name": "JadeDream", "horseNo": 11,
        "near_coat": (185, 162, 112, 255), "highlight": (218, 195, 142, 255), "far_coat": (135, 115, 78, 255),
        "mane": (155, 130, 85, 255), "hoof": (55, 48, 38, 255), "white_socks": False, "blaze": False,
        "jockey_silk": (85, 155, 65, 255), "jockey_sash": (245, 235, 210, 255), "helmet": (85, 155, 65, 255)
    },
    {
        "id": "H12", "name": "AuroraStar", "horseNo": 12,
        "near_coat": (82, 54, 40, 255), "highlight": (118, 78, 60, 255), "far_coat": (52, 32, 24, 255),
        "mane": (20, 18, 16, 255), "hoof": (28, 24, 22, 255), "white_socks": False, "blaze": True,
        "jockey_silk": (105, 120, 140, 255), "jockey_sash": (245, 205, 40, 255), "helmet": (105, 120, 140, 255)
    },
    {
        "id": "H13", "name": "SkyFire", "horseNo": 13,
        "near_coat": (205, 120, 45, 255), "highlight": (238, 155, 75, 255), "far_coat": (150, 82, 28, 255),
        "mane": (235, 155, 50, 255), "hoof": (45, 32, 24, 255), "white_socks": True, "blaze": True,
        "jockey_silk": (230, 130, 30, 255), "jockey_sash": (250, 250, 250, 255), "helmet": (230, 130, 30, 255)
    },
    {
        "id": "H14", "name": "PlainsOverlord", "horseNo": 14,
        "near_coat": (160, 75, 38, 255), "highlight": (195, 105, 60, 255), "far_coat": (112, 48, 22, 255),
        "mane": (130, 55, 25, 255), "hoof": (38, 28, 22, 255), "white_socks": False, "blaze": False,
        "jockey_silk": (140, 60, 25, 255), "jockey_sash": (210, 175, 50, 255), "helmet": (140, 60, 25, 255)
    },
    {
        "id": "H15", "name": "SilverBeam", "horseNo": 15,
        "near_coat": (215, 220, 230, 255), "highlight": (245, 248, 255, 255), "far_coat": (165, 170, 182, 255),
        "mane": (245, 248, 255, 255), "hoof": (125, 130, 142, 255), "white_socks": False, "blaze": False,
        "jockey_silk": (190, 200, 215, 255), "jockey_sash": (35, 65, 120, 255), "helmet": (190, 200, 215, 255)
    },
    {
        "id": "H16", "name": "ObsidianStorm", "horseNo": 16,
        "near_coat": (35, 35, 40, 255), "highlight": (68, 68, 76, 255), "far_coat": (20, 20, 24, 255),
        "mane": (18, 18, 22, 255), "hoof": (25, 25, 28, 255), "white_socks": False, "blaze": False,
        "jockey_silk": (45, 45, 55, 255), "jockey_sash": (190, 40, 40, 255), "helmet": (45, 45, 55, 255)
    },
    {
        "id": "H17", "name": "MoonWalker", "horseNo": 17,
        "near_coat": (125, 135, 145, 255), "highlight": (160, 170, 182, 255), "far_coat": (88, 96, 105, 255),
        "mane": (95, 105, 115, 255), "hoof": (55, 60, 68, 255), "white_socks": False, "blaze": False,
        "jockey_silk": (90, 110, 130, 255), "jockey_sash": (245, 225, 120, 255), "helmet": (90, 110, 130, 255)
    },
    {
        "id": "H18", "name": "RagingHorn", "horseNo": 18,
        "near_coat": (115, 70, 35, 255), "highlight": (155, 102, 58, 255), "far_coat": (75, 42, 20, 255),
        "mane": (80, 45, 20, 255), "hoof": (38, 26, 20, 255), "white_socks": False, "blaze": True,
        "jockey_silk": (150, 80, 40, 255), "jockey_sash": (250, 210, 40, 255), "helmet": (150, 80, 40, 255)
    },
    {
        "id": "H19", "name": "GoldenEagle", "horseNo": 19,
        "near_coat": (210, 135, 40, 255), "highlight": (245, 172, 68, 255), "far_coat": (155, 92, 25, 255),
        "mane": (245, 185, 45, 255), "hoof": (55, 38, 22, 255), "white_socks": True, "blaze": True,
        "jockey_silk": (220, 160, 20, 255), "jockey_sash": (245, 245, 245, 255), "helmet": (220, 160, 20, 255)
    },
    {
        "id": "H20", "name": "AbyssalPhantom", "horseNo": 20,
        "near_coat": (25, 28, 48, 255), "highlight": (48, 55, 85, 255), "far_coat": (14, 16, 30, 255),
        "mane": (15, 18, 32, 255), "hoof": (20, 22, 34, 255), "white_socks": False, "blaze": False,
        "jockey_silk": (30, 35, 65, 255), "jockey_sash": (160, 50, 180, 255), "helmet": (30, 35, 65, 255)
    }
]

FRAMES_KINEMATICS = [
    # 0: Right Foreleg Contact
    {"cy": 68, "pitch": 3, "nf_knee": (62, 86), "nf_hoof": (64, 108), "ff_knee": (78, 80), "ff_hoof": (92, 98), "nh_hock": (26, 78), "nh_hoof": (12, 92), "fh_hock": (34, 74), "fh_hoof": (22, 84), "head": (98, 42), "tail": (-16, 20), "jockey_pos": (50, 48)},
    # 1: Impact Loading / Compression
    {"cy": 72, "pitch": 1, "nf_knee": (60, 92), "nf_hoof": (58, 112), "ff_knee": (72, 86), "ff_hoof": (80, 106), "nh_hock": (32, 76), "nh_hoof": (22, 90), "fh_hock": (38, 72), "fh_hoof": (28, 82), "head": (96, 46), "tail": (-18, 16), "jockey_pos": (50, 52)},
    # 2: Gather
    {"cy": 69, "pitch": -3, "nf_knee": (68, 82), "nf_hoof": (62, 96), "ff_knee": (62, 78), "ff_hoof": (54, 90), "nh_hock": (44, 76), "nh_hoof": (38, 96), "fh_hock": (38, 72), "fh_hoof": (30, 90), "head": (97, 44), "tail": (-20, 12), "jockey_pos": (49, 49)},
    # 3: Rear Footfall
    {"cy": 65, "pitch": -6, "nf_knee": (74, 74), "nf_hoof": (70, 86), "ff_knee": (66, 72), "ff_hoof": (58, 80), "nh_hock": (38, 80), "nh_hoof": (32, 108), "fh_hock": (44, 76), "fh_hoof": (42, 102), "head": (100, 41), "tail": (-22, 8), "jockey_pos": (48, 45)},
    # 4: Explosive Thrust
    {"cy": 62, "pitch": -8, "nf_knee": (82, 70), "nf_hoof": (86, 80), "ff_knee": (76, 68), "ff_hoof": (78, 76), "nh_hock": (24, 78), "nh_hoof": (10, 110), "fh_hock": (30, 74), "fh_hoof": (18, 106), "head": (104, 38), "tail": (-22, 5), "jockey_pos": (49, 42)},
    # 5: Full Airborne Suspension
    {"cy": 58, "pitch": 5, "nf_knee": (88, 68), "nf_hoof": (104, 78), "ff_knee": (80, 64), "ff_hoof": (94, 72), "nh_hock": (16, 68), "nh_hoof": (-2, 82), "fh_hock": (24, 64), "fh_hoof": (6, 76), "head": (108, 36), "tail": (-20, -2), "jockey_pos": (52, 38)},
    # 6: Leading Leg Extended Forward
    {"cy": 61, "pitch": 7, "nf_knee": (84, 74), "nf_hoof": (98, 92), "ff_knee": (74, 70), "ff_hoof": (84, 82), "nh_hock": (22, 72), "nh_hoof": (8, 88), "fh_hock": (28, 68), "fh_hoof": (16, 82), "head": (106, 38), "tail": (-18, 6), "jockey_pos": (52, 41)},
    # 7: Descent / Reach
    {"cy": 65, "pitch": 5, "nf_knee": (74, 80), "nf_hoof": (82, 102), "ff_knee": (82, 74), "ff_hoof": (94, 90), "nh_hock": (24, 76), "nh_hoof": (10, 92), "fh_hock": (32, 70), "fh_hoof": (20, 84), "head": (102, 40), "tail": (-17, 14), "jockey_pos": (51, 45)}
]

def create_meta_content(asset_name):
    u = str(uuid.uuid4())
    meta = {
        "ver": "1.0.27",
        "importer": "image",
        "imported": True,
        "uuid": u,
        "files": [".json", ".png"],
        "subMetas": {
            "6c48a": {
                "importer": "texture",
                "uuid": f"{u}@6c48a",
                "displayName": asset_name,
                "id": "6c48a",
                "name": "texture",
                "userData": {
                    "wrapModeS": "clamp-to-edge",
                    "wrapModeT": "clamp-to-edge",
                    "minfilter": "linear",
                    "magfilter": "linear",
                    "mipfilter": "none",
                    "anisotropy": 0,
                    "isUuid": True,
                    "imageUuidOrDatabaseUri": u,
                    "visible": False
                },
                "ver": "1.0.22",
                "imported": True,
                "files": [".json"],
                "subMetas": {}
            }
        },
        "userData": {
            "type": "texture",
            "fixAlphaTransparencyArtifacts": False,
            "hasAlpha": True,
            "redirect": f"{u}@6c48a"
        }
    }
    return json.dumps(meta, indent=2)

def save_image_and_meta(img, target_path):
    img.save(target_path, "PNG")
    asset_name = os.path.splitext(os.path.basename(target_path))[0]
    meta_path = target_path + ".meta"
    if not os.path.exists(meta_path):
        with open(meta_path, "w", encoding="utf-8") as f:
            f.write(create_meta_content(asset_name))

def render_horse_and_jockey(palette):
    fw, fh = 128, 128
    sheet_w = fw * 8
    sheet_h = fh
    
    horse_sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    jockey_sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    
    NEAR_COAT = palette["near_coat"]
    NEAR_HIGHLIGHT = palette["highlight"]
    FAR_COAT = palette["far_coat"]
    MANE_COL = palette["mane"]
    HOOF_COL = palette["hoof"]
    EYE_COL = (20, 16, 14, 255)
    WHITE_SOCKS = palette["white_socks"]
    BLAZE = palette["blaze"]
    
    JOCKEY_SILK = palette["jockey_silk"]
    JOCKEY_SASH = palette["jockey_sash"]
    JOCKEY_PANTS = (242, 242, 246, 255)
    JOCKEY_BOOTS = (28, 24, 24, 255)
    JOCKEY_HELMET = palette["helmet"]
    REIN_COL = (70, 45, 30, 240)
    WHIP_COL = (40, 35, 35, 255)
    WHITE_MARK = (248, 248, 252, 245)

    for i, km in enumerate(FRAMES_KINEMATICS):
        ox = i * fw
        h_frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
        j_frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
        hdraw = ImageDraw.Draw(h_frame)
        jdraw = ImageDraw.Draw(j_frame)
        
        cy = km["cy"]
        shoulder = (62, cy - 8)
        hip = (36, cy - 6)
        
        # Far Foreleg
        ff_hip = (shoulder[0] - 2, shoulder[1] + 4)
        hdraw.line([ff_hip, km["ff_knee"]], fill=FAR_COAT, width=6)
        hdraw.line([km["ff_knee"], km["ff_hoof"]], fill=WHITE_MARK if WHITE_SOCKS else FAR_COAT, width=5)
        hdraw.ellipse([km["ff_hoof"][0]-3, km["ff_hoof"][1]-2, km["ff_hoof"][0]+3, km["ff_hoof"][1]+2], fill=HOOF_COL)
        
        # Far Hind Leg
        fh_hip = (hip[0] - 2, hip[1] + 2)
        hdraw.line([fh_hip, km["fh_hock"]], fill=FAR_COAT, width=7)
        hdraw.line([km["fh_hock"], km["fh_hoof"]], fill=WHITE_MARK if WHITE_SOCKS else FAR_COAT, width=5)
        hdraw.ellipse([km["fh_hoof"][0]-3, km["fh_hoof"][1]-2, km["fh_hoof"][0]+3, km["fh_hoof"][1]+2], fill=HOOF_COL)
        
        # Tail
        tail_root = (hip[0] - 8, hip[1] - 4)
        t_mid = (tail_root[0] + km["tail"][0] * 0.6, tail_root[1] + km["tail"][1] * 0.6 - 4)
        t_tip = (tail_root[0] + km["tail"][0], tail_root[1] + km["tail"][1])
        hdraw.line([tail_root, t_mid, t_tip], fill=MANE_COL, width=6)
        hdraw.line([(tail_root[0], tail_root[1]+2), (t_mid[0]-2, t_mid[1]+3), (t_tip[0]-4, t_tip[1]+4)], fill=MANE_COL, width=4)
        
        # Torso & Muscle mass
        hdraw.ellipse([hip[0] - 8, cy - 14, shoulder[0] + 12, cy + 14], fill=NEAR_COAT)
        hdraw.ellipse([hip[0] - 12, hip[1] - 14, hip[0] + 14, hip[1] + 12], fill=NEAR_COAT)
        hdraw.ellipse([shoulder[0] - 6, shoulder[1] - 12, shoulder[0] + 16, shoulder[1] + 12], fill=NEAR_COAT)
        hdraw.line([(hip[0] - 4, cy - 12), (shoulder[0] + 6, cy - 10)], fill=NEAR_HIGHLIGHT, width=3)
        
        # Neck & Head
        hx, hy = km["head"]
        withers = (shoulder[0] + 2, cy - 13)
        neck_base = (shoulder[0] + 10, cy + 4)
        
        hdraw.polygon([withers, (hx - 8, hy - 4), (hx, hy), (hx - 4, hy + 8), neck_base], fill=NEAR_COAT)
        hdraw.ellipse([hx - 10, hy - 6, hx + 8, hy + 6], fill=NEAR_COAT)
        hdraw.polygon([(hx + 4, hy - 3), (hx + 14, hy + 1), (hx + 12, hy + 5), (hx + 2, hy + 5)], fill=NEAR_COAT)
        if BLAZE:
            hdraw.line([(hx - 2, hy - 4), (hx + 10, hy + 2)], fill=WHITE_MARK, width=2)
        hdraw.ellipse([hx, hy - 2, hx + 3, hy + 1], fill=EYE_COL)
        hdraw.ellipse([hx + 11, hy + 2, hx + 13, hy + 4], fill=EYE_COL)
        hdraw.polygon([(hx - 4, hy - 6), (hx - 1, hy - 14), (hx + 2, hy - 6)], fill=NEAR_COAT)
        hdraw.polygon([(hx - 7, hy - 5), (hx - 5, hy - 12), (hx - 2, hy - 5)], fill=FAR_COAT)
        
        # Mane
        for mo in range(4):
            mx = withers[0] + (hx - withers[0]) * (mo / 3.0) - 4
            my = withers[1] + (hy - withers[1]) * (mo / 3.0) - 6
            hdraw.line([(mx, my), (mx - 7, my - 5), (mx - 12, my - 2)], fill=MANE_COL, width=3)
            
        # Near Hind Leg
        hdraw.line([hip, km["nh_hock"]], fill=NEAR_COAT, width=8)
        hdraw.line([km["nh_hock"], km["nh_hoof"]], fill=WHITE_MARK if WHITE_SOCKS else NEAR_COAT, width=6)
        hdraw.ellipse([km["nh_hoof"][0]-4, km["nh_hoof"][1]-3, km["nh_hoof"][0]+4, km["nh_hoof"][1]+3], fill=HOOF_COL)
        
        # Near Foreleg
        hdraw.line([shoulder, km["nf_knee"]], fill=NEAR_COAT, width=7)
        hdraw.line([km["nf_knee"], km["nf_hoof"]], fill=WHITE_MARK if WHITE_SOCKS else NEAR_COAT, width=5)
        hdraw.ellipse([km["nf_hoof"][0]-4, km["nf_hoof"][1]-3, km["nf_hoof"][0]+4, km["nf_hoof"][1]+3], fill=HOOF_COL)
        
        # --- Jockey & Saddlecloth ---
        jx, jy = km["jockey_pos"]
        
        # Saddle Cloth with Number
        hdraw.polygon([(jx - 14, jy + 6), (jx + 8, jy + 6), (jx + 6, jy + 18), (jx - 12, jy + 18)], fill=JOCKEY_SILK)
        hdraw.line([(jx - 14, jy + 6), (jx + 8, jy + 6), (jx + 6, jy + 18), (jx - 12, jy + 18), (jx - 14, jy + 6)], fill=(245, 205, 55, 255), width=1)
        hdraw.ellipse([jx - 5, jy + 9, jx + 1, jy + 15], fill=(255, 255, 255, 255))
        
        # Stirrup
        jdraw.line([(jx - 2, jy + 8), (jx + 2, jy + 19)], fill=(40, 30, 25, 255), width=2)
        jdraw.ellipse([jx + 1, jy + 18, jx + 4, jy + 21], fill=(180, 185, 190, 255))
        
        # Jockey legs & boots
        jdraw.polygon([(jx - 8, jy + 2), (jx + 4, jy + 6), (jx + 3, jy + 18), (jx - 4, jy + 12)], fill=JOCKEY_PANTS)
        jdraw.polygon([(jx, jy + 12), (jx + 4, jy + 18), (jx + 1, jy + 20), (jx - 3, jy + 14)], fill=JOCKEY_BOOTS)
        
        # Jockey torso
        jdraw.polygon([(jx - 10, jy + 2), (jx + 6, jy - 2), (jx + 8, jy + 5), (jx - 6, jy + 6)], fill=JOCKEY_SILK)
        jdraw.line([(jx - 8, jy + 3), (jx + 6, jy)], fill=JOCKEY_SASH, width=3)
        
        # Arms & Reins
        hand_pos = (jx + 14, jy + 1)
        jdraw.line([(jx - 2, jy - 1), (jx + 8, jy + 2), hand_pos], fill=JOCKEY_SILK, width=3)
        bit_pos = (hx + 8, hy + 3)
        jdraw.line([hand_pos, bit_pos], fill=REIN_COL, width=1)
        jdraw.line([hand_pos, (hand_pos[0] - 12, hand_pos[1] - 8)], fill=WHIP_COL, width=2)
        
        # Head & Helmet
        head_cx, head_cy = (jx + 8, jy - 7)
        jdraw.ellipse([head_cx - 5, head_cy - 5, head_cx + 5, head_cy + 5], fill=JOCKEY_HELMET)
        jdraw.polygon([(head_cx + 2, head_cy - 2), (head_cx + 7, head_cy - 1), (head_cx + 3, head_cy + 2)], fill=(30, 30, 35, 255))
        jdraw.line([(head_cx - 4, head_cy), (head_cx + 3, head_cy)], fill=(220, 220, 230, 255), width=2)
        
        horse_sheet.paste(h_frame, (ox, 0), h_frame)
        jockey_sheet.paste(j_frame, (ox, 0), j_frame)
        
    return horse_sheet, jockey_sheet

def main():
    os.makedirs(HORSES_DIR, exist_ok=True)
    print(f"=== Generating 20 Unique 8-Frame Gallop Sheets for H01 - H20 into {HORSES_DIR} ===")
    
    for p in HORSE_PALETTES:
        hid = p["id"]
        hname = p["name"]
        h_img, j_img = render_horse_and_jockey(p)
        
        h_path = os.path.join(HORSES_DIR, f"{hid}_{hname}_Gallop_8f.png")
        j_path = os.path.join(HORSES_DIR, f"{hid}_{hname}_Jockey_8f.png")
        save_image_and_meta(h_img, h_path)
        save_image_and_meta(j_img, j_path)
        print(f"[{hid}] Generated {os.path.basename(h_path)} & {os.path.basename(j_path)}")
        
    print("=== Successfully generated all 20 individual gallop and jockey sheets! ===")

if __name__ == "__main__":
    main()
