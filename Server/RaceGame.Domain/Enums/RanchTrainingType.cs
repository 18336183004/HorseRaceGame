namespace RaceGame.Domain.Enums;

/// <summary>
/// 青年马四大专项骑术训练项目枚举。
/// </summary>
public enum RanchTrainingType
{
    /// <summary>短程爆发冲刺 (Sprint): 速度大幅增长, 爆发微幅增长</summary>
    Sprint = 1,

    /// <summary>环道负重耐力 (Lope): 耐力大幅增长, 心理定力微幅增长</summary>
    Lope = 2,

    /// <summary>弯道机动折返 (Corner): 灵敏大幅增长, 速度微幅增长</summary>
    Corner = 3,

    /// <summary>坡地越野耐挫 (Hill): 爆发大幅增长, 耐力微幅增长</summary>
    Hill = 4
}
