namespace RaceGame.Domain.Enums;

/// <summary>
/// 纯血马匹血统层级枚举。
/// </summary>
public enum PedigreeTier
{
    /// <summary>怀俄明荒野改良马 (上限 69 点)</summary>
    Wild = 1,

    /// <summary>柯尔特平原纯血马 (上限 84 点)</summary>
    PlainsTb = 2,

    /// <summary>皇家冠军御厩纯血 (上限 94 点)</summary>
    Royal = 3,

    /// <summary>传奇名驹神殿血统 (上限 100 点)</summary>
    Mythic = 4
}
