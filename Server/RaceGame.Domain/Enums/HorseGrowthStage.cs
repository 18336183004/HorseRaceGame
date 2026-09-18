namespace RaceGame.Domain.Enums;

/// <summary>
/// 纯血马匹主生命周期阶段枚举。
/// </summary>
public enum HorseGrowthStage
{
    /// <summary>幼驹 (Lv.1~10)：仅可喂食</summary>
    Foal = 1,

    /// <summary>青年马 (Lv.10~20)：可专项训练、日常护理与调教</summary>
    Juvenile = 2,

    /// <summary>成年马 (Lv.20+)：可装配马具、繁育配种与资格考核</summary>
    Mature = 3,

    /// <summary>职业赛马：通过 400m 资格审查并获得全服执照，可参与职业杯赛与公开拍卖交易</summary>
    ProRacer = 4
}
