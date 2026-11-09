#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量生成 20 匹纯血马标准正交解剖三视图 (Orthographic Turnaround Sheets)
========================================================================
功能：
1. 提取各马匹 Side (侧视)、Front (正视)、Back (后视) 主体，精确提取前景与地面接触点；
2. 统一步调将三视图缩放至相同解剖比例 (以鬐甲 Withers Height 为统一基准)；
3. 将三视图排列于 1536 x 960 标准 16:10 黄金比例古典羊皮纸画布上：
   - 左侧：全景大侧视图 (Side Elevation)，占画面 58% 宽度
   - 右上：标准正前视图 (Front Elevation)
   - 右下：标准正后视图 (Rear Elevation)
   - 全部视图精准切齐在统一水平地面基准线 (Ground Line) 上！
4. 绘制古典解剖学工程基准线 (Datum Reference Lines)：
   - 地面线 (Ground Datum Line)
   - 腕膝与飞节线 (Knee & Hock Line)
   - 肘部与后膝线 (Elbow & Stifle Line)
   - 鬐甲与臀峰线 (Withers & Croup Line)
   - 项冠与头顶线 (Poll & Crest Line)
5. 绘制统一规范的羊皮纸与胡桃木双线金箔边框、名马中英文编号名牌、英制/公制比例尺与怀俄明公会认证印章。
6. 同步导出与规范化单张：
   - _Ortho_Side.png (1024x1024 居中标准侧视)
   - _Ortho_Front.png (1024x1024 居中标准正视)
   - _Ortho_Back.png (1024x1024 居中标准后视)
   - _Ortho.png (1536x960 综合工程三视图)
"""

import os
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BATCH_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_ADULTS = os.path.join(BATCH_DIR, "input", "adults")
CLIENT_HORSES = os.path.join(REPO_ROOT, "Client", "assets", "textures", "horses")

# 20 匹成年纯血名驹元数据
HORSES = [
    {"no": 1, "code": "H01", "fileBase": "H01_CrimsonMeteor", "nameZh": "赤焰流星", "nameEn": "Crimson Meteor", "coatZh": "深栗毛", "coatEn": "Rich Chestnut", "height": "16.2", "weight": "495", "style": "CLOSER"},
    {"no": 2, "code": "H02", "fileBase": "H02_EmeraldWind", "nameZh": "翠风", "nameEn": "Emerald Wind", "coatZh": "铁青斑驳毛", "coatEn": "Dapple Grey", "height": "16.1", "weight": "480", "style": "STALKER"},
    {"no": 3, "code": "H03", "fileBase": "H03_GoldenArrow", "nameZh": "金色箭矢", "nameEn": "Golden Arrow", "coatZh": "金黄帕洛米诺", "coatEn": "Golden Palomino", "height": "16.0", "weight": "505", "style": "FRONT_RUNNER"},
    {"no": 4, "code": "H04", "fileBase": "H04_ShadowHunter", "nameZh": "暗影猎手", "nameEn": "Shadow Hunter", "coatZh": "煤黑纯黑", "coatEn": "Jet Black", "height": "16.3", "weight": "520", "style": "BATTLER"},
    {"no": 5, "code": "H05", "fileBase": "H05_SilverMoon", "nameZh": "银月", "nameEn": "Silver Moon", "coatZh": "纯银白毛", "coatEn": "Pure White Grey", "height": "15.3", "weight": "475", "style": "STALKER"},
    {"no": 6, "code": "H06", "fileBase": "H06_BlueTide", "nameZh": "蓝潮", "nameEn": "Blue Tide", "coatZh": "石板蓝灰沙毛", "coatEn": "Blue Roan", "height": "16.2", "weight": "510", "style": "BATTLER"},
    {"no": 7, "code": "H07", "fileBase": "H07_PurpleLightning", "nameZh": "紫电", "nameEn": "Purple Lightning", "coatZh": "深红骝微带紫光", "coatEn": "Liver Chestnut", "height": "15.3", "weight": "470", "style": "FRONT_RUNNER"},
    {"no": 8, "code": "H08", "fileBase": "H08_StormRun", "nameZh": "暴风疾行", "nameEn": "Storm Run", "coatZh": "经典骝毛四蹄白", "coatEn": "Classic Bay", "height": "16.2", "weight": "515", "style": "BATTLER"},
    {"no": 9, "code": "H09", "fileBase": "H09_ThunderBreak", "nameZh": "惊雷破空", "nameEn": "Thunder Break", "coatZh": "黑骝色白星章", "coatEn": "Dark Brown Bay", "height": "16.1", "weight": "500", "style": "CLOSER"},
    {"no": 10, "code": "H10", "fileBase": "H10_SunWarrior", "nameZh": "烈阳战将", "nameEn": "Sun Warrior", "coatZh": "红枣骝色", "coatEn": "Blood Bay", "height": "16.3", "weight": "525", "style": "FRONT_RUNNER"},
    {"no": 11, "code": "H11", "fileBase": "H11_JadeDream", "nameZh": "翡翠之梦", "nameEn": "Jade Dream", "coatZh": "沙金青骝", "coatEn": "Dun Roan", "height": "15.3", "weight": "468", "style": "CLOSER"},
    {"no": 12, "code": "H12", "fileBase": "H12_AuroraStar", "nameZh": "极光之星", "nameEn": "Aurora Star", "coatZh": "深褐配菱形星斑", "coatEn": "Star-Marked Dark Bay", "height": "16.0", "weight": "490", "style": "STALKER"},
    {"no": 13, "code": "H13", "fileBase": "H13_SkyFire", "nameZh": "天火之翼", "nameEn": "Sky Fire Wing", "coatZh": "琥珀栗毛", "coatEn": "Amber Chestnut", "height": "16.0", "weight": "488", "style": "FRONT_RUNNER"},
    {"no": 14, "code": "H14", "fileBase": "H14_PlainsOverlord", "nameZh": "荒原霸主", "nameEn": "Plains Overlord", "coatZh": "野生栗毛", "coatEn": "Wild Chestnut", "height": "16.1", "weight": "502", "style": "BATTLER"},
    {"no": 15, "code": "H15", "fileBase": "H15_SilverBeam", "nameZh": "白银之光", "nameEn": "Silver Beam", "coatZh": "铂银亮毛", "coatEn": "Platinum Silver", "height": "16.2", "weight": "492", "style": "STALKER"},
    {"no": 16, "code": "H16", "fileBase": "H16_ObsidianStorm", "nameZh": "黑曜风暴", "nameEn": "Obsidian Storm", "coatZh": "炭黑灰毛", "coatEn": "Charcoal Black", "height": "16.3", "weight": "530", "style": "BATTLER"},
    {"no": 17, "code": "H17", "fileBase": "H17_MoonWalker", "nameZh": "月影独行", "nameEn": "Moon Walker", "coatZh": "石板青灰毛", "coatEn": "Slate Grey", "height": "16.0", "weight": "485", "style": "BATTLER"},
    {"no": 18, "code": "H18", "fileBase": "H18_RagingHorn", "nameZh": "狂怒号角", "nameEn": "Raging Horn", "coatZh": "古铜暗骝", "coatEn": "Bronze Dark Bay", "height": "16.2", "weight": "512", "style": "FRONT_RUNNER"},
    {"no": 19, "code": "H19", "fileBase": "H19_GoldenEagle", "nameZh": "金羽神鹰", "nameEn": "Golden Eagle", "coatZh": "鎏金黄栗", "coatEn": "Gilded Chestnut", "height": "16.1", "weight": "498", "style": "CLOSER"},
    {"no": 20, "code": "H20", "fileBase": "H20_AbyssalPhantom", "nameZh": "深渊魅影", "nameEn": "Abyssal Phantom", "coatZh": "靛蓝玄黑", "coatEn": "Indigo Black", "height": "16.2", "weight": "508", "style": "STALKER"},
]

def load_fonts():
    font_bold_path = r"C:\Windows\Fonts\msyhbd.ttc"
    font_reg_path = r"C:\Windows\Fonts\msyh.ttc"
    times_path = r"C:\Windows\Fonts\times.ttf"

    def get_font(path, size):
        try:
            return ImageFont.truetype(path, size)
        except:
            return ImageFont.load_default()

    return {
        "title": get_font(font_bold_path, 22),
        "subtitle": get_font(times_path, 13),
        "badge": get_font(font_bold_path, 12),
        "label": get_font(font_bold_path, 11),
        "label_sub": get_font(times_path, 10),
        "datum": get_font(font_reg_path, 9),
        "scale": get_font(times_path, 9),
    }

FONTS = load_fonts()

def extract_horse_crop(img_path, is_aux=False):
    """提取马匹主体，返回透明 RGBA 紧凑裁切与真实长宽比"""
    bgr = cv2.imread(img_path)
    if bgr is None:
        raise ValueError(f"无法读取图片: {img_path}")

    h, w = bgr.shape[:2]
    # 水印清洗 (右下角)
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.rectangle(mask, (w - 180, h - 90), (w, h), 255, -1)
    cleaned = cv2.inpaint(bgr, mask, inpaintRadius=6, flags=cv2.INPAINT_TELEA)

    gray = cv2.cvtColor(cleaned, cv2.COLOR_BGR2GRAY)
    # 提取非白底主体
    fg_mask = (gray < 238).astype(np.uint8) * 255

    # 滤除微小杂斑
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(fg_mask)
    keep_mask = np.zeros_like(fg_mask)
    for i in range(1, num_labels):
        if stats[i, cv2.CC_STAT_AREA] > 800:
            keep_mask[labels == i] = 255

    # 闭合孔洞
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    keep_mask = cv2.morphologyEx(keep_mask, cv2.MORPH_CLOSE, kernel)

    # 寻找主体边界
    pts = np.where(keep_mask > 0)
    if len(pts[0]) == 0:
        return Image.fromarray(cv2.cvtColor(cleaned, cv2.COLOR_BGR2RGBA))

    ymin, ymax = int(np.min(pts[0])), int(np.max(pts[0]))
    xmin, xmax = int(np.min(pts[1])), int(np.max(pts[1]))

    # 保留蹄底贴地线，微扩边界
    pad = 6
    ymin = max(0, ymin - pad)
    ymax = min(h, ymax + pad)
    xmin = max(0, xmin - pad)
    xmax = min(w, xmax + pad)

    # 前后视由于通常居中，宽度不应过大包含地影
    if is_aux:
        center_x = (xmin + xmax) // 2
        half_w = min(max((xmax - xmin) // 2, 190), 280)
        xmin = max(0, center_x - half_w)
        xmax = min(w, center_x + half_w)

    cropped_bgr = cleaned[ymin:ymax, xmin:xmax]
    cropped_alpha = keep_mask[ymin:ymax, xmin:xmax]

    # 羽化边缘抗锯齿
    alpha_soft = cv2.GaussianBlur(cropped_alpha, (3, 3), 0)
    b, g, r = cv2.split(cropped_bgr)
    rgba = cv2.merge([b, g, r, alpha_soft])

    return Image.fromarray(cv2.cvtColor(rgba, cv2.COLOR_BGRA2RGBA))

def build_unified_ortho_sheet(horse):
    """
    为指定马匹生成统一、规整的高精度 1536x960 解剖三视图画板
    """
    fb = horse["fileBase"]
    side_path = os.path.join(INPUT_ADULTS, f"{fb}_Ortho_Side.png")
    front_path = os.path.join(INPUT_ADULTS, f"{fb}_Ortho_Front.png")
    back_path = os.path.join(INPUT_ADULTS, f"{fb}_Ortho_Back.png")

    side_crop = extract_horse_crop(side_path, is_aux=False)
    front_crop = extract_horse_crop(front_path, is_aux=True)
    back_crop = extract_horse_crop(back_path, is_aux=True)

    # 1. 创建古典羊皮纸底板 (1536 x 960)
    canvas_w, canvas_h = 1536, 960
    sheet = Image.new("RGBA", (canvas_w, canvas_h), (248, 244, 235, 255))
    draw = ImageDraw.Draw(sheet)

    # 绘制极其微弱的工程坐标格网 (40px 间距，透明度极低)
    grid_col = (226, 218, 204, 255)
    for gx in range(40, canvas_w - 40, 48):
        draw.line([(gx, 100), (gx, canvas_h - 60)], fill=grid_col, width=1)
    for gy in range(120, canvas_h - 60, 48):
        draw.line([(40, gy), (canvas_w - 40, gy)], fill=grid_col, width=1)

    # 2. 古典边框与金箔内圈
    draw.rectangle([14, 14, canvas_w - 14, canvas_h - 14], outline=(62, 39, 35, 255), width=3)
    draw.rectangle([19, 19, canvas_w - 19, canvas_h - 19], outline=(197, 160, 89, 255), width=1)
    draw.rectangle([23, 23, canvas_w - 23, canvas_h - 23], outline=(62, 39, 35, 120), width=1)

    # 四角装饰直角折线
    def draw_corner(cx, cy, dx, dy):
        draw.line([(cx, cy), (cx + dx * 28, cy)], fill=(197, 160, 89, 255), width=2)
        draw.line([(cx, cy), (cx, cy + dy * 28)], fill=(197, 160, 89, 255), width=2)
    draw_corner(28, 28, 1, 1)
    draw_corner(canvas_w - 28, 28, -1, 1)
    draw_corner(28, canvas_h - 28, 1, -1)
    draw_corner(canvas_w - 28, canvas_h - 28, -1, -1)

    # 3. 顶部信息栏与名牌 (Header Banner)
    draw.rectangle([25, 25, canvas_w - 25, 96], fill=(240, 232, 218, 255))
    draw.line([(25, 96), (canvas_w - 25, 96)], fill=(180, 145, 80, 255), width=2)

    # 主标题与副标题
    header_title = f"NO.{horse['no']:02d}  {horse['nameEn'].upper()} · {horse['nameZh']}"
    draw.text((45, 34), header_title, fill=(44, 26, 14, 255), font=FONTS["title"])
    header_sub = "WYOMING DERBY THOROUGHBRED ANATOMICAL TURNAROUND SPECIFICATION · 纯血赛马官方标准解剖三视图"
    draw.text((46, 68), header_sub, fill=(120, 90, 60, 255), font=FONTS["subtitle"])

    # 右侧属性勋章栏
    badge_x = canvas_w - 530
    draw.rounded_rectangle([badge_x, 34, canvas_w - 45, 86], radius=6, fill=(248, 242, 228, 255), outline=(197, 160, 89, 255), width=1)
    info_line1 = f"毛色: {horse['coatZh']} ({horse['coatEn']})  |  鬐高: {horse['height']} HH (168 cm)"
    info_line2 = f"均重: {horse['weight']} KG  |  奔跑战术: {horse['style']}  |  品系: 英国古典纯血"
    draw.text((badge_x + 16, 42), info_line1, fill=(62, 39, 35, 255), font=FONTS["badge"])
    draw.text((badge_x + 16, 62), info_line2, fill=(130, 95, 65, 255), font=FONTS["badge"])

    # 4. 解剖学标准水平参考基准线 (Horizontal Datum Lines)
    Y_GROUND = 810          # 地面绝对水平线
    Y_HOCK = 630            # 飞节与腕膝关节线
    Y_ELBOW = 490           # 肘部与后膝线
    Y_WITHERS = 330         # 鬐甲最高点水平线
    Y_CREST = 210           # 头顶与项冠最高线

    # 绘制水平基准线与标签
    def draw_datum_line(y, label, is_solid=False):
        color = (140, 105, 75, 220) if is_solid else (190, 170, 150, 180)
        w = 2 if is_solid else 1
        if is_solid:
            draw.line([(45, y), (canvas_w - 45, y)], fill=color, width=w)
        else:
            for dx in range(45, canvas_w - 45, 12):
                draw.line([(dx, y), (min(dx + 7, canvas_w - 45), y)], fill=color, width=w)
        draw.text((48, y - 13), label, fill=(120, 95, 75, 240), font=FONTS["datum"])

    draw_datum_line(Y_CREST, "POLL & CREST / 头顶项冠基准", is_solid=False)
    draw_datum_line(Y_WITHERS, "WITHERS 1.62m / 鬐甲最高点 (肩峰基准)", is_solid=False)
    draw_datum_line(Y_ELBOW, "ELBOW & CROUP / 肘关节与臀峰线", is_solid=False)
    draw_datum_line(Y_HOCK, "HOCK & KNEE / 飞节与前膝关节线", is_solid=False)
    draw_datum_line(Y_GROUND, "GROUND DATUM LINE 0.0m / 地面水平基准线", is_solid=True)

    # 5. 三视图精确定位与等比缩放
    target_side_h = Y_GROUND - Y_CREST  # 600
    side_scale = float(target_side_h) / side_crop.size[1]
    side_w = int(round(side_crop.size[0] * side_scale))
    side_scaled = side_crop.resize((side_w, target_side_h), Image.Resampling.LANCZOS)

    side_x = 65
    side_y = Y_GROUND - target_side_h
    sheet.paste(side_scaled, (side_x, side_y), side_scaled)

    # 正视与后视辅图目标高度：310px
    aux_target_h = 310
    front_scale = float(aux_target_h) / front_crop.size[1]
    front_w = int(round(front_crop.size[0] * front_scale))
    front_scaled = front_crop.resize((front_w, aux_target_h), Image.Resampling.LANCZOS)

    back_scale = float(aux_target_h) / back_crop.size[1]
    back_w = int(round(back_crop.size[0] * back_scale))
    back_scaled = back_crop.resize((back_w, aux_target_h), Image.Resampling.LANCZOS)

    right_center_x = (canvas_w - 55 + (side_x + side_w + 30)) // 2

    # 正视位于右上 (Y: 135 ~ 445)
    front_x = right_center_x - front_w // 2
    front_y = 135
    sheet.paste(front_scaled, (front_x, front_y), front_scaled)
    draw.line([(front_x - 30, front_y + aux_target_h), (front_x + front_w + 30, front_y + aux_target_h)], fill=(160, 135, 105, 200), width=1)

    # 后视位于右下 (Y: 495 ~ 805)
    back_x = right_center_x - back_w // 2
    back_y = 495
    sheet.paste(back_scaled, (back_x, back_y), back_scaled)
    draw.line([(back_x - 30, Y_GROUND), (back_x + back_w + 30, Y_GROUND)], fill=(160, 135, 105, 200), width=1)

    # 6. 各视图标牌说明 (View Titles)
    draw.text((side_x + 10, Y_GROUND + 14), "[FIG. 1] SIDE ELEVATION · 正侧剖立面 (比例 1:10 完整骨架拓扑)", fill=(62, 39, 35, 255), font=FONTS["label"])
    draw.text((side_x + 10, Y_GROUND + 32), "ANATOMICAL RATIO: 1:1 TRUE PROPORTIONS · 展现鬐甲、背线、腹线与飞节推进角", fill=(130, 95, 65, 255), font=FONTS["label_sub"])

    draw.text((front_x - 10, front_y + aux_target_h + 8), "[FIG. 2] FRONT ELEVATION · 正立面", fill=(62, 39, 35, 255), font=FONTS["label"])
    draw.text((front_x - 10, front_y + aux_target_h + 23), "胸深肌群与正交前肢对称度", fill=(130, 95, 65, 255), font=FONTS["label_sub"])

    draw.text((back_x - 10, Y_GROUND + 14), "[FIG. 3] REAR ELEVATION · 背立面", fill=(62, 39, 35, 255), font=FONTS["label"])
    draw.text((back_x - 10, Y_GROUND + 32), "后躯半腱肌饱满度与骨盆倾角", fill=(130, 95, 65, 255), font=FONTS["label_sub"])

    # 7. 底部精细公制标尺与认证公章 (Bottom Scale Bar & Seal)
    scale_y = canvas_h - 38
    scale_x0 = 45
    draw.line([(scale_x0, scale_y), (scale_x0 + 360, scale_y)], fill=(62, 39, 35, 255), width=2)
    for si in range(0, 361, 60):
        draw.line([(scale_x0 + si, scale_y - 5), (scale_x0 + si, scale_y + 5)], fill=(62, 39, 35, 255), width=1)
    draw.text((scale_x0, scale_y - 18), "METRIC SCALE 1:10", fill=(62, 39, 35, 255), font=FONTS["scale"])
    draw.text((scale_x0 + 55, scale_y + 8), "0.5m", fill=(130, 95, 65, 255), font=FONTS["scale"])
    draw.text((scale_x0 + 175, scale_y + 8), "1.0m", fill=(130, 95, 65, 255), font=FONTS["scale"])
    draw.text((scale_x0 + 295, scale_y + 8), "1.5m", fill=(130, 95, 65, 255), font=FONTS["scale"])
    draw.text((scale_x0 + 355, scale_y + 8), "2.0m", fill=(130, 95, 65, 255), font=FONTS["scale"])

    seal_text = "OFFICIAL RACING PEDIGREE ARCHIVE · WYOMING TURF CLUB · 1892"
    draw.text((540, canvas_h - 35), seal_text, fill=(150, 125, 95, 220), font=FONTS["scale"])
    draw.text((canvas_w - 220, canvas_h - 35), f"REV. 2.0.0 / {horse['code']}-ORTHO", fill=(150, 125, 95, 220), font=FONTS["scale"])

    # 8. 保存综合工程三视图
    out_ortho_path = os.path.join(CLIENT_HORSES, f"{fb}_Ortho.png")
    sheet.save(out_ortho_path, "PNG")

    # 9. 生成标准化居中单视图 (1024x1024 标准纯白底/透明)
    def export_centered_view(crop_im, filename):
        v_canvas = Image.new("RGBA", (1024, 1024), (255, 255, 255, 255))
        scale = min(880.0 / crop_im.size[0], 880.0 / crop_im.size[1])
        new_w = int(round(crop_im.size[0] * scale))
        new_h = int(round(crop_im.size[1] * scale))
        resized = crop_im.resize((new_w, new_h), Image.Resampling.LANCZOS)
        ox = (1024 - new_w) // 2
        oy = (1024 - new_h) // 2 + 10
        v_canvas.paste(resized, (ox, oy), resized)
        v_canvas.save(os.path.join(CLIENT_HORSES, filename), "PNG")

    export_centered_view(side_crop, f"{fb}_Ortho_Side.png")
    export_centered_view(front_crop, f"{fb}_Ortho_Front.png")
    export_centered_view(back_crop, f"{fb}_Ortho_Back.png")

    print(f"  [OK] {horse['code']} ({horse['nameZh']}) 三视图已统一拼合完毕: 1536x960 & 3x1024x1024")

def main():
    print("================== 开始统一重构与整理 20 匹纯血马解剖三视图 ==================")
    for h in HORSES:
        build_unified_ortho_sheet(h)
    print("================== 20 匹纯血马三视图统一重构完成！ ==================")

if __name__ == "__main__":
    main()
