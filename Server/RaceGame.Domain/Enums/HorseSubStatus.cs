namespace RaceGame.Domain.Enums;

/// <summary>
/// 纯血马匹伴生生理与业务锁定子状态枚举。
/// </summary>
public enum HorseSubStatus
{
    /// <summary>空闲待命，可接受常规指令</summary>
    Idle = 1,

    /// <summary>已锁定参与巡回赛事</summary>
    InRace = 2,

    /// <summary>挂牌全服拍卖行竞价中，属性与归属锁定</summary>
    AuctionLocked = 3,

    /// <summary>已发起点对点协议转让，等待买家确认</summary>
    TransferLocked = 4,

    /// <summary>妊娠受孕期，严禁剧烈训练与比赛</summary>
    Pregnant = 5,

    /// <summary>配种后或高强度训练后的冷却休整</summary>
    Resting = 6,

    /// <summary>意外受伤（肌腱炎、蹄裂），需理疗</summary>
    Injured = 7,

    /// <summary>积食腹痛或微恙，需益生菌或兽医治疗</summary>
    Sick = 8,

    /// <summary>已被系统保底回购或退役注销，状态终结</summary>
    Retired = 9
}
