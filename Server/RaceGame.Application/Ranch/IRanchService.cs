using RaceGame.Domain.Entities;

namespace RaceGame.Application.Ranch;

public sealed record RanchHorseDto(
    long Id,
    long OwnerPlayerId,
    string HorseCode,
    string CustomName,
    string Gender,
    string GrowthStage,
    int Level,
    int CurrentExp,
    int MaxExp,
    string PedigreeTier,
    int Generation,
    string CoatColor,
    string RunningStyle,
    decimal SpeedStat,
    decimal SpeedPotential,
    decimal StaminaStat,
    decimal StaminaPotential,
    decimal BurstStat,
    decimal BurstPotential,
    decimal AgilityStat,
    decimal AgilityPotential,
    decimal TemperamentStat,
    decimal TemperamentPotential,
    int HungerLevel,
    int StaminaEnergy,
    int ConditionLevel,
    int HoofWear,
    int IntimacyLevel,
    int HealthPoints,
    long? SaddleItemId,
    long? StirrupItemId,
    long? HorseshoeItemId,
    bool IsLicensedRacer,
    decimal? QualificationTime,
    string? LicenseCertCode,
    int TotalCareerRaces,
    int TotalCareerWins,
    decimal AccumulatedPurse,
    string SubStatus,
    DateTime CreatedAt);

public sealed record RanchEquipmentDto(
    long Id,
    string ItemCode,
    string ItemName,
    string SlotCategory,
    decimal SpeedBonus,
    decimal StaminaBonus,
    decimal BurstBonus,
    decimal AgilityBonus,
    int MaxDurability,
    decimal PriceCoin);

public sealed record PlayerEquipmentDto(
    long Id,
    long EquipmentItemId,
    string ItemCode,
    string ItemName,
    string SlotCategory,
    long? EquippedHorseId,
    int CurrentDurability,
    bool IsEquipped);

public sealed record FeedResultDto(
    bool Success,
    bool ColicTriggered,
    int NewLevel,
    int NewExp,
    int NewHunger,
    int NewCondition,
    string GrowthStage,
    decimal NewBalance);

public sealed record TrainResultDto(
    bool Success,
    string TrainingType,
    decimal SpeedDelta,
    decimal StaminaDelta,
    decimal BurstDelta,
    decimal AgilityDelta,
    decimal TemperamentDelta,
    int NewStaminaEnergy,
    int NewHoofWear,
    int NewCondition,
    int NewLevel,
    int NewExp,
    decimal NewBalance);

public sealed record CareResultDto(
    bool Success,
    string CareType,
    int NewCondition,
    int NewStaminaEnergy,
    int NewIntimacy,
    int NewHealthPoints,
    string SubStatus,
    decimal NewBalance);

public sealed record TrialResultDto(
    bool IsPassed,
    decimal TrialTime,
    decimal StandardBenchmark,
    decimal FeeCharged,
    string? LicenseCertCode,
    string GrowthStage,
    decimal NewBalance);

public sealed record BuybackResultDto(
    long HorseId,
    decimal PayoutAmount,
    decimal NewBalance);

public sealed record RepairEquipmentResultDto(
    long PlayerEquipmentId,
    decimal RepairCost,
    int NewDurability,
    decimal NewBalance);

public sealed record FoalTierCatalogDto(
    string TierCode,
    string TierNameZh,
    string TierNameEn,
    decimal AdoptPrice,
    decimal MinPotential,
    decimal MaxPotential,
    decimal BaseSpeed,
    decimal BaseStamina,
    decimal BaseBurst,
    decimal BaseAgility,
    decimal BaseTemperament,
    string DescriptionZh,
    string DescriptionEn,
    List<string> RandomNames);

public sealed record FeedCatalogDto(
    string FeedCode,
    string FeedNameZh,
    string FeedNameEn,
    string FeedCategory,
    decimal CoinCost,
    int HungerFill,
    int ExpGain,
    int ConditionBonus,
    decimal BurstBonus,
    decimal TemperamentBonus,
    string DescriptionZh,
    string DescriptionEn);

public sealed record TrainingCatalogDto(
    string TrainingType,
    string TrainingNameZh,
    string TrainingNameEn,
    decimal CoinCost,
    int EnergyCost,
    int ExpGain,
    int HoofWearDelta,
    int ConditionLoss,
    decimal SpeedDelta,
    decimal StaminaDelta,
    decimal BurstDelta,
    decimal AgilityDelta,
    decimal TemperamentDelta,
    string DescriptionZh,
    string DescriptionEn);

public sealed record CareCatalogDto(
    string CareType,
    string CareNameZh,
    string CareNameEn,
    decimal CoinCost,
    int CooldownHours,
    int IntimacyBonus,
    int ConditionBonus,
    int HealthBonus,
    int EnergyBonus,
    int HoofWearRelief,
    bool ClearsIllness,
    bool ClearsInjury,
    string DescriptionZh,
    string DescriptionEn);

public sealed record RanchCatalogDto(
    List<FoalTierCatalogDto> FoalTiers,
    List<FeedCatalogDto> Feeds,
    List<TrainingCatalogDto> Trainings,
    List<CareCatalogDto> Cares,
    decimal QualificationBenchmark,
    decimal QualificationBaseTime,
    decimal QualificationLicenseFee);

public interface IRanchService
{
    Task<RanchCatalogDto> GetRanchCatalogAsync(CancellationToken ct = default);

    Task<RanchHorseDto> AdoptFoalAsync(long playerId, string customName, string pedigreeTier, string? idempotencyKey, CancellationToken ct = default);

    Task<List<RanchHorseDto>> GetMyHorsesAsync(long playerId, CancellationToken ct = default);

    Task<RanchHorseDto?> GetHorseDetailsAsync(long playerId, long horseId, CancellationToken ct = default);

    Task<FeedResultDto> FeedHorseAsync(long playerId, long horseId, string feedCode, string? idempotencyKey, CancellationToken ct = default);

    Task<TrainResultDto> TrainHorseAsync(long playerId, long horseId, string trainingType, string? idempotencyKey, CancellationToken ct = default);

    Task<CareResultDto> CareHorseAsync(long playerId, long horseId, string careType, string? idempotencyKey, CancellationToken ct = default);

    Task<(List<RanchEquipmentDto> ShopCatalog, List<PlayerEquipmentDto> Inventory)> GetEquipmentShopAndInventoryAsync(long playerId, CancellationToken ct = default);

    Task<PlayerEquipmentDto> BuyAndEquipItemAsync(long playerId, long horseId, long equipmentItemId, string? idempotencyKey, CancellationToken ct = default);

    Task<bool> UnequipItemAsync(long playerId, long horseId, string slotCategory, CancellationToken ct = default);

    Task<RepairEquipmentResultDto> RepairEquipmentAsync(long playerId, long playerEquipmentId, string? idempotencyKey, CancellationToken ct = default);

    Task<TrialResultDto> RunQualificationTrialAsync(long playerId, long horseId, string? idempotencyKey, CancellationToken ct = default);

    Task<BuybackResultDto> BuybackHorseAsync(long playerId, long horseId, string? idempotencyKey, CancellationToken ct = default);
}

