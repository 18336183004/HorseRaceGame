namespace RaceGame.Domain.Enums;

/// <summary>
/// 赛马日常护理与理疗行为枚举。
/// </summary>
public enum RanchCareType
{
    /// <summary>软毛刷梳理安抚 (5 COIN): 亲密度 +10, 调子 +5</summary>
    Groom = 1,

    /// <summary>牵引漫步 (10 COIN): 恢复 15 点体力能量</summary>
    HandWalk = 2,

    /// <summary>理疗推拿与草本泥敷 (50 COIN): 瞬间清除疲劳, 调子直升至 100 绝好调</summary>
    PhysioMud = 3,

    /// <summary>专业钉蹄修整 (25 COIN): 蹄铁磨损 -40, 健康值 +10</summary>
    Farrier = 4,

    /// <summary>益生菌调理冲剂 (30 COIN): 解除积食腹痛, 调子恢复至 60, 健康值 +15</summary>
    Probiotic = 5
}
