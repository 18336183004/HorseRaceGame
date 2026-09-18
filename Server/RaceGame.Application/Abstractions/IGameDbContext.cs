using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using RaceGame.Domain.Entities;

namespace RaceGame.Application.Abstractions;

/// <summary>
/// 应用层使用的持久化边界。
///
/// <remarks>
/// 应用服务只依赖此抽象，不直接依赖 Infrastructure，避免项目循环引用。
/// EF Core 类型目前作为基础设施边界的一部分暴露，以便保持现有查询能力；后续可按业务域逐步收窄为仓储接口。
/// </remarks>
/// </summary>
public interface IGameDbContext
{
    /// <summary>访问 Players 对应的持久化集合。</summary>
    DbSet<Player> Players { get; }
    /// <summary>访问 PlayerCredentials 对应的持久化集合。</summary>
    DbSet<PlayerCredential> PlayerCredentials { get; }
    /// <summary>访问 PlayerSessions 对应的持久化集合。</summary>
    DbSet<PlayerSession> PlayerSessions { get; }
    /// <summary>访问 PlayerSettings 对应的持久化集合。</summary>
    DbSet<PlayerSetting> PlayerSettings { get; }
    /// <summary>访问 PlayerAuthAuditLogs 对应的持久化集合。</summary>
    DbSet<PlayerAuthAuditLog> PlayerAuthAuditLogs { get; }
    /// <summary>访问 Wallets 对应的持久化集合。</summary>
    DbSet<Wallet> Wallets { get; }
    /// <summary>访问 WalletTransactions 对应的持久化集合。</summary>
    DbSet<WalletTransaction> WalletTransactions { get; }
    /// <summary>访问 AdminUsers 对应的持久化集合。</summary>
    DbSet<AdminUser> AdminUsers { get; }
    /// <summary>访问 AdminRoles 对应的持久化集合。</summary>
    DbSet<AdminRole> AdminRoles { get; }
    /// <summary>访问 AdminPermissions 对应的持久化集合。</summary>
    DbSet<AdminPermission> AdminPermissions { get; }
    /// <summary>访问 AdminUserRoles 对应的持久化集合。</summary>
    DbSet<AdminUserRole> AdminUserRoles { get; }
    /// <summary>访问 AdminRolePermissions 对应的持久化集合。</summary>
    DbSet<AdminRolePermission> AdminRolePermissions { get; }
    /// <summary>访问 AdminSessions 对应的持久化集合。</summary>
    DbSet<AdminSession> AdminSessions { get; }
    /// <summary>访问 AdminAuditLogs 对应的持久化集合。</summary>
    DbSet<AdminAuditLog> AdminAuditLogs { get; }
    /// <summary>访问 RaceRuleConfigs 对应的持久化集合。</summary>
    DbSet<RaceRuleConfig> RaceRuleConfigs { get; }
    /// <summary>访问 HorseCatalogs 对应的持久化集合。</summary>
    DbSet<HorseCatalog> HorseCatalogs { get; }
    /// <summary>访问 CharacterCatalogs 对应的持久化集合。</summary>
    DbSet<CharacterCatalog> CharacterCatalogs { get; }
    /// <summary>访问 CosmeticCatalogs 对应的持久化集合。</summary>
    DbSet<CosmeticCatalog> CosmeticCatalogs { get; }
    /// <summary>访问 CharacterLevelConfigs 对应的持久化集合。</summary>
    DbSet<CharacterLevelConfig> CharacterLevelConfigs { get; }
    /// <summary>访问 ItemCatalogs 对应的持久化集合。</summary>
    DbSet<ItemCatalog> ItemCatalogs { get; }
    /// <summary>访问 PlayerCharacters 对应的持久化集合。</summary>
    DbSet<PlayerCharacter> PlayerCharacters { get; }
    /// <summary>访问 PlayerCosmetics 对应的持久化集合。</summary>
    DbSet<PlayerCosmetic> PlayerCosmetics { get; }
    /// <summary>访问 PlayerItems 对应的持久化集合。</summary>
    DbSet<PlayerItem> PlayerItems { get; }
    /// <summary>访问 PlayerItemTransactions 对应的持久化集合。</summary>
    DbSet<PlayerItemTransaction> PlayerItemTransactions { get; }
    /// <summary>访问 ShopProducts 对应的持久化集合。</summary>
    DbSet<ShopProduct> ShopProducts { get; }
    /// <summary>访问 ShopOrders 对应的持久化集合。</summary>
    DbSet<ShopOrder> ShopOrders { get; }
    /// <summary>访问 ShopOrderDeliveries 对应的持久化集合。</summary>
    DbSet<ShopOrderDelivery> ShopOrderDeliveries { get; }
    /// <summary>访问 DailyTaskDefinitions 对应的持久化集合。</summary>
    DbSet<DailyTaskDefinition> DailyTaskDefinitions { get; }
    /// <summary>访问 PlayerDailyTasks 对应的持久化集合。</summary>
    DbSet<PlayerDailyTask> PlayerDailyTasks { get; }
    /// <summary>访问 DailyTaskClaims 对应的持久化集合。</summary>
    DbSet<DailyTaskClaim> DailyTaskClaims { get; }
    /// <summary>访问 Notices 对应的持久化集合。</summary>
    DbSet<Notice> Notices { get; }
    /// <summary>访问 PlayerNoticeReads 对应的持久化集合。</summary>
    DbSet<PlayerNoticeRead> PlayerNoticeReads { get; }
    /// <summary>访问 PlayerStats 对应的持久化集合。</summary>
    DbSet<PlayerStat> PlayerStats { get; }
    /// <summary>访问 PlayerReliefGrants 对应的持久化集合。</summary>
    DbSet<PlayerReliefGrant> PlayerReliefGrants { get; }
    /// <summary>访问 WalletAdjustmentRequests 对应的持久化集合。</summary>
    DbSet<WalletAdjustmentRequest> WalletAdjustmentRequests { get; }
    /// <summary>访问 WalletAdjustmentApprovals 对应的持久化集合。</summary>
    DbSet<WalletAdjustmentApproval> WalletAdjustmentApprovals { get; }
    /// <summary>访问 RaceRounds 对应的持久化集合。</summary>
    DbSet<RaceRound> RaceRounds { get; }
    /// <summary>访问 RaceHorses 对应的持久化集合。</summary>
    DbSet<RaceHorse> RaceHorses { get; }
    /// <summary>访问 RaceBetSelections 对应的持久化集合。</summary>
    DbSet<RaceBetSelection> RaceBetSelections { get; }
    /// <summary>访问 BetOrders 对应的持久化集合。</summary>
    DbSet<BetOrder> BetOrders { get; }
    /// <summary>访问 RaceRoundStateLogs 对应的持久化集合。</summary>
    DbSet<RaceRoundStateLog> RaceRoundStateLogs { get; }
    /// <summary>访问 RaceSettlementRuns 对应的持久化集合。</summary>
    DbSet<RaceSettlementRun> RaceSettlementRuns { get; }
    /// <summary>访问 BetOrderSettlementLogs 对应的持久化集合。</summary>
    DbSet<BetOrderSettlementLog> BetOrderSettlementLogs { get; }
    /// <summary>访问 JobExecutionLogs 对应的持久化集合。</summary>
    DbSet<JobExecutionLog> JobExecutionLogs { get; }
    /// <summary>访问 RaceLogs 对应的持久化集合。</summary>
    DbSet<RaceLog> RaceLogs { get; }
    /// <summary>访问 HorseLogs 对应的持久化集合。</summary>
    DbSet<HorseLog> HorseLogs { get; }
    /// <summary>访问 CharacterLogs 对应的持久化集合。</summary>
    DbSet<CharacterLog> CharacterLogs { get; }
    /// <summary>访问 AchievementDefinitions 对应的持久化集合。</summary>
    DbSet<AchievementDefinition> AchievementDefinitions { get; }
    /// <summary>访问 PlayerAchievements 对应的持久化集合。</summary>
    DbSet<PlayerAchievement> PlayerAchievements { get; }
    /// <summary>访问 PlayerReferralRewards 对应的持久化集合。</summary>
    DbSet<PlayerReferralReward> PlayerReferralRewards { get; }
    /// <summary>访问 JackpotPools 对应的持久化集合。</summary>
    DbSet<JackpotPool> JackpotPools { get; }
    /// <summary>访问 JackpotDropLogs 对应的持久化集合。</summary>
    DbSet<JackpotDropLog> JackpotDropLogs { get; }
    /// <summary>访问 PlayerHorseStables 对应的持久化集合。</summary>
    DbSet<PlayerHorseStable> PlayerHorseStables { get; }
    /// <summary>访问 HorseDividends 对应的持久化集合。</summary>
    DbSet<HorseDividend> HorseDividends { get; }

    /// <summary>访问 RanchHorses 对应的持久化集合。</summary>
    DbSet<RanchHorse> RanchHorses { get; }
    /// <summary>访问 RanchEquipmentItems 对应的持久化集合。</summary>
    DbSet<RanchEquipmentItem> RanchEquipmentItems { get; }
    /// <summary>访问 RanchHorseEquipments 对应的持久化集合。</summary>
    DbSet<RanchHorseEquipment> RanchHorseEquipments { get; }
    /// <summary>访问 RanchFeedLogs 对应的持久化集合。</summary>
    DbSet<RanchFeedLog> RanchFeedLogs { get; }
    /// <summary>访问 RanchTrainingLogs 对应的持久化集合。</summary>
    DbSet<RanchTrainingLog> RanchTrainingLogs { get; }
    /// <summary>访问 RanchQualificationTrials 对应的持久化集合。</summary>
    DbSet<RanchQualificationTrial> RanchQualificationTrials { get; }
    /// <summary>访问 BackgroundJobs 对应的持久化集合。</summary>
    DbSet<BackgroundJob> BackgroundJobs { get; }

    /// <summary>访问 RaceEnvironments 对应的持久化集合。</summary>
    DbSet<RaceEnvironment> RaceEnvironments { get; }
    /// <summary>访问 RaceCommentaryTemplates 对应的持久化集合。</summary>
    DbSet<RaceCommentaryTemplate> RaceCommentaryTemplates { get; }
    /// <summary>访问 RaceTipsterTemplates 对应的持久化集合。</summary>
    DbSet<RaceTipsterTemplate> RaceTipsterTemplates { get; }
    /// <summary>访问 RanchFoalTiers 对应的持久化集合。</summary>
    DbSet<RanchFoalTier> RanchFoalTiers { get; }
    /// <summary>访问 RanchFeedCatalogs 对应的持久化集合。</summary>
    DbSet<RanchFeedCatalog> RanchFeedCatalogs { get; }
    /// <summary>访问 RanchTrainingCatalogs 对应的持久化集合。</summary>
    DbSet<RanchTrainingCatalog> RanchTrainingCatalogs { get; }
    /// <summary>访问 RanchCareCatalogs 对应的持久化集合。</summary>
    DbSet<RanchCareCatalog> RanchCareCatalogs { get; }

    /// <summary>访问当前数据库事务/连接能力。</summary>
    DatabaseFacade Database { get; }

    /// <summary>提交当前工作单元中的变更。</summary>
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
