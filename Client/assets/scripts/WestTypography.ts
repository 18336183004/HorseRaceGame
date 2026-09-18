import { Color, HorizontalTextAlignment, Label, LabelOutline, Node, UITransform } from "cc";
import { WestColors } from "./WestTheme";

/**
 * 《西部边境赛马会》四级排版与字体系统 (v2.1)
 * 遵循 racegame-project-standards，严禁 any。
 *
 * 西部感的 70% 来自字体与排版紧实度：
 * 1. 四级字体阶梯：Display (44-56) / Heading (28-32) / Body (22-24) / Caption (16-18)；
 * 2. 紧实排版行高规则：lineHeight = fontSize + 6px (杜绝松垮)；
 * 3. 中英文混排：中文采用思源黑体，数字与英文采用西部 Playfair / 衬线体；
 * 4. 主标题活字微描边：0.5px INK_BROWN 墨线描边，模拟 19 世纪活字印刷凸版印痕；
 * 5. 严格禁用系统默认无衬线字体与 Arial/Roboto。
 */

export type TypographyLevel = "display" | "heading" | "body" | "caption";

export interface TypographyOptions {
    size?: number;
    color?: Color;
    align?: HorizontalTextAlignment;
    isBold?: boolean;
    isItalic?: boolean;
    enableLetterpressOutline?: boolean;
    outlineColor?: Color;
    outlineWidth?: number;
    maxWidth?: number;
    maxHeight?: number;
    overflow?: number;
}

export class WestTypography {
    /** 西部专属字体族优先列表 (禁用 Arial, Roboto) */
    public static readonly FONT_FAMILY =
        "'Playfair Display', 'Source Han Sans CN', '思源黑体', 'Noto Serif SC', 'Georgia', serif";

    /**
     * 四级字体阶梯基准配置
     */
    public static readonly SPEC = {
        display: {
            minSize: 44,
            maxSize: 56,
            defaultSize: 48,
            bold: true,
            hasOutline: true,
            outlineWidth: 1.0,
            defaultColor: WestColors.INK_BROWN,
        },
        heading: {
            minSize: 28,
            maxSize: 32,
            defaultSize: 30,
            bold: true,
            hasOutline: false,
            outlineWidth: 0,
            defaultColor: WestColors.INK_BROWN,
        },
        body: {
            minSize: 22,
            maxSize: 24,
            defaultSize: 22,
            bold: false,
            hasOutline: false,
            outlineWidth: 0,
            defaultColor: WestColors.INK_BROWN,
        },
        caption: {
            minSize: 16,
            maxSize: 18,
            defaultSize: 16,
            bold: false,
            hasOutline: false,
            outlineWidth: 0,
            defaultColor: WestColors.INK_SOFT,
        },
    } as const;

    /**
     * 为已有 Label 组件注入西部排版规范
     */
    public static apply(
        label: Label,
        level: TypographyLevel,
        options?: TypographyOptions,
    ): void {
        const spec = this.SPEC[level];
        const fontSize = options?.size ?? spec.defaultSize;

        label.fontFamily = this.FONT_FAMILY;
        label.fontSize = fontSize;
        // 关键规则：lineHeight = fontSize + 6px
        label.lineHeight = fontSize + 6;
        label.isBold = options?.isBold ?? spec.bold;
        label.isItalic = options?.isItalic ?? false;
        label.color = options?.color ?? spec.defaultColor;

        if (options?.maxWidth && options.maxWidth > 0) {
            const ut = label.node.getComponent(UITransform) || label.node.addComponent(UITransform);
            const targetH = options.maxHeight && options.maxHeight > 0 ? options.maxHeight : (fontSize + 6) * 2;
            ut.setContentSize(options.maxWidth, targetH);
            label.overflow = options.overflow ?? Label.Overflow.RESIZE_HEIGHT;
        } else if (options?.overflow !== undefined) {
            label.overflow = options.overflow;
        }

        if (options?.align !== undefined) {
            label.horizontalAlign = options?.align;
            const ut = label.node.getComponent(UITransform);
            if (ut) {
                if (options.align === HorizontalTextAlignment.LEFT) {
                    ut.setAnchorPoint(0, 0.5);
                } else if (options.align === HorizontalTextAlignment.RIGHT) {
                    ut.setAnchorPoint(1, 0.5);
                } else {
                    ut.setAnchorPoint(0.5, 0.5);
                }
            }
        }

        // Display 级别或显式开启时添加 0.5~1px 活字墨线微描边
        const shouldOutline = options?.enableLetterpressOutline ?? spec.hasOutline;
        if (shouldOutline) {
            let outline = label.node.getComponent(LabelOutline);
            if (!outline) {
                outline = label.node.addComponent(LabelOutline);
            }
            outline.color = options?.outlineColor ?? WestColors.INK_BROWN;
            outline.width = options?.outlineWidth ?? spec.outlineWidth;
            outline.enabled = true;
        }
    }

    /**
     * 在父节点上快速构建符合排版阶梯的 Label 节点
     */
    public static createLabel(
        parent: Node,
        content: string,
        x: number,
        y: number,
        level: TypographyLevel = "body",
        options?: TypographyOptions,
    ): Label {
        const node = new Node(`Text_${level}`);
        node.layer = parent.layer;
        parent.addChild(node);
        node.setPosition(x, y);

        const label = node.addComponent(Label);
        label.string = content;
        this.apply(label, level, options);
        return label;
    }
}
