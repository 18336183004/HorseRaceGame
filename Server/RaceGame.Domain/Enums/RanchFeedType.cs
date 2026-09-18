namespace RaceGame.Domain.Enums;

/// <summary>
/// 牧场饲料类型枚举。
/// </summary>
public enum RanchFeedType
{
    /// <summary>优质梯牧草 (粗料, 10 COIN, +50 EXP, +35 饱腹)</summary>
    Timothy = 1,

    /// <summary>苜蓿草捆 (粗料, 25 COIN, +120 EXP, +40 饱腹)</summary>
    Alfalfa = 2,

    /// <summary>熟化压片燕麦 (精料, 40 COIN, +200 EXP, +25 饱腹)</summary>
    Oats = 3,

    /// <summary>复合强化蛋白饼 (精料, 80 COIN, +450 EXP, +30 饱腹)</summary>
    Protein = 4
}
