#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
赛马高清美术资产清洗、重构与全量集成工具
==========================================
功能：
1. 全量去除右下角 AI 水印 (基于 OpenCV Telea 与色彩平滑修复)
2. 修复 H11-H15 展示立绘 (Showcase)，解决银马占位重复问题
3. 批量高精拼合 H01-H20 全部 20 匹成年马 Ortho 解剖三视图大图 (1280x844+)
4. 批量生成 20 匹名驹真透明背景跑道精灵 (Sprite, RGBA, 256px 标准高)
5. 批量清洗 F01-F20 共 80 张小马四阶段成长图鉴
6. 将全部优质资产直接分发至 Client/assets/textures/horses 与 foals
"""

import os
import sys
import shutil
import cv2
import numpy as np
from PIL import Image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BATCH_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_ADULTS = os.path.join(BATCH_DIR, "input", "adults")
INPUT_FOALS = os.path.join(BATCH_DIR, "input", "foals")
INPUT_GRIDS = os.path.join(BATCH_DIR, "input", "grids")

CLIENT_HORSES = os.path.join(REPO_ROOT, "Client", "assets", "textures", "horses")
CLIENT_FOALS = os.path.join(REPO_ROOT, "Client", "assets", "textures", "foals")

# 20 匹成年名驹清单与元数据
ADULT_HORSES = [
    {"code": "H01", "fileBase": "H01_CrimsonMeteor", "nameZh": "赤焰流星", "coat": "深栗毛"},
    {"code": "H02", "fileBase": "H02_EmeraldWind", "nameZh": "翠风", "coat": "铁青斑驳毛"},
    {"code": "H03", "fileBase": "H03_GoldenArrow", "nameZh": "金色箭矢", "coat": "金黄帕洛米诺"},
    {"code": "H04", "fileBase": "H04_ShadowHunter", "nameZh": "暗影猎手", "coat": "煤黑纯黑"},
    {"code": "H05", "fileBase": "H05_SilverMoon", "nameZh": "银月", "coat": "纯银白毛"},
    {"code": "H06", "fileBase": "H06_BlueTide", "nameZh": "蓝潮", "coat": "石板蓝灰沙毛"},
    {"code": "H07", "fileBase": "H07_PurpleLightning", "nameZh": "紫电", "coat": "深红骝微带紫光"},
    {"code": "H08", "fileBase": "H08_StormRun", "nameZh": "暴风疾行", "coat": "经典骝毛四蹄白"},
    {"code": "H09", "fileBase": "H09_ThunderBreak", "nameZh": "惊雷破空", "coat": "黑骝色白星章"},
    {"code": "H10", "fileBase": "H10_SunWarrior", "nameZh": "烈阳战将", "coat": "红枣骝色"},
    # H11-H15 特别配对 grids 独有立绘
    {"code": "H11", "fileBase": "H11_JadeDream", "nameZh": "翡翠之梦", "coat": "沙金青骝", "gridShowcase": "h2upydRAPA1a57be.jpg"},
    {"code": "H12", "fileBase": "H12_AuroraStar", "nameZh": "极光之星", "coat": "深褐配菱形星斑", "gridShowcase": "hdIge_hryRCPN9hN.jpg"},
    {"code": "H13", "fileBase": "H13_SkyFire", "nameZh": "天火之翼", "coat": "琥珀栗毛", "gridShowcase": "ur6NMW50RhUdFLeP.jpg"},
    {"code": "H14", "fileBase": "H14_PlainsOverlord", "nameZh": "荒原霸主", "coat": "野生栗毛", "gridShowcase": "GbfErffvwA4EusFz.jpg"},
    {"code": "H15", "fileBase": "H15_SilverBeam", "nameZh": "白银之光", "coat": "铂银亮毛", "gridShowcase": "RoZ8mYg0cTFyEqXg.jpg"},
    {"code": "H16", "fileBase": "H16_ObsidianStorm", "nameZh": "黑曜风暴", "coat": "炭黑灰毛"},
    {"code": "H17", "fileBase": "H17_MoonWalker", "nameZh": "月影独行", "coat": "石板青灰毛"},
    {"code": "H18", "fileBase": "H18_RagingHorn", "nameZh": "狂怒号角", "coat": "古铜暗骝"},
    {"code": "H19", "fileBase": "H19_GoldenEagle", "nameZh": "金羽神鹰", "coat": "鎏金黄栗"},
    {"code": "H20", "fileBase": "H20_AbyssalPhantom", "nameZh": "深渊魅影", "coat": "靛蓝玄黑"},
]


def remove_watermark_inpaint(img_bgr, radius=8):
    """去除右下角 Xiaomi MiMo 水印"""
    h, w = img_bgr.shape[:2]
    # 水印胶囊标签在右下角
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.rectangle(mask, (w - 190, h - 95), (w, h), 255, -1)
    cleaned = cv2.inpaint(img_bgr, mask, inpaintRadius=radius, flags=cv2.INPAINT_TELEA)
    return cleaned


def clean_white_bg_image(src_path):
    """清洗纯白/浅色背景单图，无痕去除右下角水印"""
    bgr = cv2.imread(src_path)
    if bgr is None:
        raise ValueError(f"无法读取图片: {src_path}")
    h, w = bgr.shape[:2]
    # 水印区域平滑修补
    cleaned = remove_watermark_inpaint(bgr, radius=7)
    # 针对白底单图，右下角安全区若为背景直接做平滑纯白对齐
    bg_sample = cleaned[max(0, h - 110):h - 95, max(0, w - 210):w - 190]
    if bg_sample.mean() > 235:
        cleaned[h - 90:h, w - 180:w] = 255
    return Image.fromarray(cv2.cvtColor(cleaned, cv2.COLOR_BGR2RGBA))


def trim_horse_white_bg(pil_im, is_aux_view=False):
    """自动裁切多余留白，保留马匹主体与四蹄地面细节"""
    arr = np.array(pil_im.convert("RGB"))
    h, w = arr.shape[:2]
    # 判断背景：非马匹区域通常接近纯白
    is_bg = (arr[:, :, 0] >= 242) & (arr[:, :, 1] >= 242) & (arr[:, :, 2] >= 242)
    rows = np.any(~is_bg, axis=1)
    cols = np.any(~is_bg, axis=0)
    if not rows.any() or not cols.any():
        return pil_im

    ymin, ymax = int(np.min(np.where(rows)[0])), int(np.max(np.where(rows)[0]))
    xmin, xmax = int(np.min(np.where(cols)[0])), int(np.max(np.where(cols)[0]))

    if is_aux_view:
        # 正面/背面图马匹居中，宽度一般为 350-450，限制宽度避免纳入过宽的浅地影
        center_x = w // 2
        half_w = max((xmax - xmin) // 2 + 15, 230)
        xmin = max(0, center_x - half_w)
        xmax = min(w, center_x + half_w)

    pad = 8
    ymin = max(0, ymin - pad)
    ymax = min(h, ymax + pad)
    xmin = max(0, xmin - pad)
    xmax = min(w, xmax + pad)

    return pil_im.crop((xmin, ymin, xmax, ymax))


def make_transparent_sprite(side_img_path, out_path, target_h=256):
    """基于 GrabCut 与轮廓分析生成无水印、高锐度的真透明跑道精灵图"""
    bgr = cv2.imread(side_img_path)
    h, w = bgr.shape[:2]

    # 1. 消除水印
    clean_bgr = remove_watermark_inpaint(bgr, radius=7)
    clean_bgr[h - 90:h, w - 185:w] = 255

    # 2. GrabCut 分割前景
    gc_mask = np.zeros((h, w), dtype=np.uint8)
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)

    is_white = (clean_bgr[:, :, 0] > 246) & (clean_bgr[:, :, 1] > 246) & (clean_bgr[:, :, 2] > 246)
    gc_mask[:] = cv2.GC_PR_FGD
    gc_mask[is_white] = cv2.GC_PR_BGD
    # 边缘作为确认背景
    gc_mask[:15, :] = cv2.GC_BGD
    gc_mask[-15:, :] = cv2.GC_BGD
    gc_mask[:, :15] = cv2.GC_BGD
    gc_mask[:, -15:] = cv2.GC_BGD

    cv2.grabCut(clean_bgr, gc_mask, None, bgd_model, fgd_model, 3, cv2.GC_INIT_WITH_MASK)
    fg_mask = np.where((gc_mask == cv2.GC_FGD) | (gc_mask == cv2.GC_PR_FGD), 255, 0).astype("uint8")

    # 3. 闭合马匹内部空洞
    contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        largest = max(contours, key=cv2.contourArea)
        filled = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(filled, [largest], -1, 255, -1)
        fg_mask = cv2.bitwise_or(fg_mask, filled)

    # 4. 边缘微抗锯齿
    alpha = cv2.GaussianBlur(fg_mask, (3, 3), 0)

    b, g, r = cv2.split(clean_bgr)
    rgba = cv2.merge([b, g, r, alpha])

    # 5. 紧凑裁切
    non_empty = np.where(fg_mask > 0)
    if len(non_empty[0]) == 0:
        return
    ymin, ymax = int(np.min(non_empty[0])), int(np.max(non_empty[0]))
    xmin, xmax = int(np.min(non_empty[1])), int(np.max(non_empty[1]))
    pad = 6
    ymin = max(0, ymin - pad)
    ymax = min(h, ymax + pad)
    xmin = max(0, xmin - pad)
    xmax = min(w, xmax + pad)

    cropped = rgba[ymin:ymax, xmin:xmax]
    pil_im = Image.fromarray(cv2.cvtColor(cropped, cv2.COLOR_BGRA2RGBA))

    # 6. 等比缩放至 256 高度
    ratio = float(target_h) / pil_im.size[1]
    target_w = max(1, int(round(pil_im.size[0] * ratio)))
    resized = pil_im.resize((target_w, target_h), Image.Resampling.LANCZOS)
    resized.save(out_path)


def compose_ortho_sheet(side_im, front_im, back_im, out_path):
    """拼合高质量 Ortho 三视图 (左侧大侧视图 780高，右上正视 360高，右下后视 360高)"""
    def fit_h(im, h):
        w = max(1, int(round(im.size[0] * h / im.size[1])))
        return im.resize((w, h), Image.Resampling.LANCZOS)

    side_h = 780
    aux_h = 360
    gap = 28
    margin = 32

    side_f = fit_h(side_im, side_h)
    front_f = fit_h(front_im, aux_h)
    back_f = fit_h(back_im, aux_h)

    right_w = max(front_f.size[0], back_f.size[0])
    total_w = margin + side_f.size[0] + gap + right_w + margin
    total_h = margin + side_h + margin

    sheet = Image.new("RGBA", (total_w, total_h), (255, 255, 255, 255))
    # 粘贴侧视
    sheet.paste(side_f, (margin, margin + (side_h - side_f.size[1]) // 2), side_f)

    # 粘贴正视 (右上)
    rx1 = margin + side_f.size[0] + gap + (right_w - front_f.size[0]) // 2
    sheet.paste(front_f, (rx1, margin + 20), front_f)

    # 粘贴后视 (右下)
    rx2 = margin + side_f.size[0] + gap + (right_w - back_f.size[0]) // 2
    sheet.paste(back_f, (rx2, margin + 20 + aux_h + 20), back_f)

    sheet.save(out_path)


def process_adult_showcase(horse):
    """处理展示立绘，支持油画修复与 grids 独有立绘无痕横版扩展"""
    fb = horse["fileBase"]
    dest_path = os.path.join(CLIENT_HORSES, f"{fb}_Showcase.png")
    adult_input_path = os.path.join(INPUT_ADULTS, f"{fb}_Showcase.png")

    if "gridShowcase" in horse:
        # H11-H15: 替换原有纯银马重复占位，采用 grids 中独有的立绘
        grid_src = os.path.join(INPUT_GRIDS, horse["gridShowcase"])
        grid_im = Image.open(grid_src).convert("RGB")
        arr = np.array(grid_im)
        bg_col = tuple(arr[0, 0].tolist())

        canvas_w, canvas_h = 1536, 1024
        target_h = 960
        scale = target_h / float(grid_im.size[1])
        target_w = int(round(grid_im.size[0] * scale))
        scaled_horse = grid_im.resize((target_w, target_h), Image.Resampling.LANCZOS)

        canvas = Image.new("RGB", (canvas_w, canvas_h), bg_col)
        offset_x = (canvas_w - target_w) // 2
        offset_y = (canvas_h - target_h) // 2
        canvas.paste(scaled_horse, (offset_x, offset_y))

        # 同样更新至 input/adults 与客户端
        canvas.save(adult_input_path)
        canvas.save(dest_path)
        print(f"  [Showcase] {horse['code']} ({horse['nameZh']}) 已采用 grids 专属立绘重构为 1536x1024")
    else:
        # H01-H10, H16-H20: 采用古典油画横版，去除水印
        bgr = cv2.imread(adult_input_path)
        cleaned_bgr = remove_watermark_inpaint(bgr, radius=8)
        cleaned_pil = Image.fromarray(cv2.cvtColor(cleaned_bgr, cv2.COLOR_BGR2RGBA))

        cleaned_pil.save(adult_input_path)
        cleaned_pil.save(dest_path)
        print(f"  [Showcase] {horse['code']} ({horse['nameZh']}) 古典油画立绘水印已消除并归档")


def process_all_adults():
    """全量处理 20 匹成年马单图、拼合三视图、展示立绘与透明跑道精灵"""
    print("\n================== 开始处理 20 匹成年马美术资产 ==================")
    os.makedirs(CLIENT_HORSES, exist_ok=True)

    for h in ADULT_HORSES:
        code = h["code"]
        fb = h["fileBase"]
        print(f"\n>> 正在处理 {code} 【{h['nameZh']}】({h['coat']})...")

        # 1. 处理 Showcase
        process_adult_showcase(h)

        # 2. 清洗正/侧/背三张单图
        front_src = os.path.join(INPUT_ADULTS, f"{fb}_Ortho_Front.png")
        side_src = os.path.join(INPUT_ADULTS, f"{fb}_Ortho_Side.png")
        back_src = os.path.join(INPUT_ADULTS, f"{fb}_Ortho_Back.png")

        clean_front = clean_white_bg_image(front_src)
        clean_side = clean_white_bg_image(side_src)
        clean_back = clean_white_bg_image(back_src)

        # 覆盖回 input/adults 与 client
        clean_front.save(front_src)
        clean_front.save(os.path.join(CLIENT_HORSES, f"{fb}_Ortho_Front.png"))
        clean_side.save(side_src)
        clean_side.save(os.path.join(CLIENT_HORSES, f"{fb}_Ortho_Side.png"))
        clean_back.save(back_src)
        clean_back.save(os.path.join(CLIENT_HORSES, f"{fb}_Ortho_Back.png"))

        # 3. 裁切并拼合 Ortho 三视图
        trimmed_front = trim_horse_white_bg(clean_front, is_aux_view=True)
        trimmed_side = trim_horse_white_bg(clean_side, is_aux_view=False)
        trimmed_back = trim_horse_white_bg(clean_back, is_aux_view=True)

        ortho_client_path = os.path.join(CLIENT_HORSES, f"{fb}_Ortho.png")
        ortho_input_path = os.path.join(INPUT_ADULTS, f"{fb}_Ortho.png")
        compose_ortho_sheet(trimmed_side, trimmed_front, trimmed_back, ortho_client_path)
        shutil.copy2(ortho_client_path, ortho_input_path)
        with Image.open(ortho_client_path) as ortho_im:
            print(f"  [Ortho] 三视图拼合完成: {ortho_im.size[0]}x{ortho_im.size[1]}")

        # 4. 生成跑道透明精灵 (Sprite)
        sprite_client_path = os.path.join(CLIENT_HORSES, f"{fb}_Sprite.png")
        make_transparent_sprite(side_src, sprite_client_path, target_h=256)
        with Image.open(sprite_client_path) as sp_im:
            print(f"  [Sprite] 透明跑道精灵生成完成: {sp_im.size[0]}x{sp_im.size[1]} (RGBA)")


def process_all_foals():
    """全量处理 20 匹小马 × 4 阶段成长图鉴 (共 80 张)"""
    print("\n================== 开始处理 20 匹小马四阶段成长图鉴 (80张) ==================")
    os.makedirs(CLIENT_FOALS, exist_ok=True)

    files = sorted([f for f in os.listdir(INPUT_FOALS) if f.endswith(".png")])
    for idx, fname in enumerate(files):
        src_path = os.path.join(INPUT_FOALS, fname)
        dest_path = os.path.join(CLIENT_FOALS, fname)

        bgr = cv2.imread(src_path)
        if bgr is None:
            continue
        h, w = bgr.shape[:2]

        # 消除右下角水印
        cleaned_bgr = remove_watermark_inpaint(bgr, radius=8)
        cleaned_pil = Image.fromarray(cv2.cvtColor(cleaned_bgr, cv2.COLOR_BGR2RGBA))

        cleaned_pil.save(src_path)
        cleaned_pil.save(dest_path)

        if (idx + 1) % 10 == 0 or idx == len(files) - 1:
            print(f"  已清洗归档小马图鉴: {idx + 1}/{len(files)} 张 ({fname})")


def cleanup_temp_files():
    """清理测试过程生成的临时图片"""
    temp_files = [
        "test_inpaint.png", "test_inpaint_foal.png", "test_sprite_h02.png",
        "test_grabcut_h02.png", "test_ortho_h02.png", "test_trimmed_back.png",
        "test_h11_showcase.png"
    ]
    for tf in temp_files:
        tp = os.path.join(BATCH_DIR, tf)
        if os.path.exists(tp):
            try:
                os.remove(tp)
            except Exception:
                pass


def main():
    print("=== 开始执行赛马全量美术资产修复与重构 ===")
    cleanup_temp_files()
    process_all_adults()
    process_all_foals()
    print("\n=== 全部美术资产清洗、重构与归档完成！ ===")


if __name__ == "__main__":
    main()
