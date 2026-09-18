namespace RaceGame.Domain.Enums;

/// <summary>
/// 赛马投注玩法类型枚举。
/// </summary>
public enum PlayType
{
    /// <summary>单马独赢：选择 1 匹马夺冠 (6 选 1)。</summary>
    Win = 1,

    /// <summary>二连碰/连赢：任选 2 匹马包揽前二名，不分名次先后 (15 组组合)。</summary>
    Quinella = 2,

    /// <summary>位置/秀选：选择 1 匹马跑入前二名 (新手高胜率保底盘)。</summary>
    Place = 3,

    /// <summary>位置连赢/扩连赢：任选 2 匹马双双跑入前三名。</summary>
    QuinellaPlace = 4,

    /// <summary>二连单/准确单：任选 2 匹马严格按顺序包揽第 1、第 2 名 (30 组组合)。</summary>
    Exacta = 5,

    /// <summary>三连碰/三重彩：任选 3 匹马包揽前三名 (不分名次先后，20 组)。</summary>
    Trio = 6,

    /// <summary>三连单：任选 3 匹马严格按顺序包揽第 1、第 2、第 3 名 (120 组，千倍大奖)。</summary>
    Trifecta = 7
}
