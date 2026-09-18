using Microsoft.EntityFrameworkCore;
using RaceGame.Application.Abstractions;
using RaceGame.Domain.Entities;
using RaceGame.Domain.Enums;

namespace RaceGame.Infrastructure.Persistence;

/// <summary>EF Core 主数据库上下文，集中维护 PostgreSQL 表名、索引、精度和关系映射。</summary>
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IGameDbContext
{
    public DbSet<Player> Players => Set<Player>();

    public DbSet<PlayerCredential> PlayerCredentials => Set<PlayerCredential>();

    public DbSet<PlayerSession> PlayerSessions => Set<PlayerSession>();

    public DbSet<PlayerSetting> PlayerSettings => Set<PlayerSetting>();

    public DbSet<PlayerAuthAuditLog> PlayerAuthAuditLogs => Set<PlayerAuthAuditLog>();

    public DbSet<Wallet> Wallets => Set<Wallet>();

    public DbSet<WalletTransaction> WalletTransactions => Set<WalletTransaction>();

    public DbSet<AdminUser> AdminUsers => Set<AdminUser>();

    public DbSet<AdminRole> AdminRoles => Set<AdminRole>();

    public DbSet<AdminPermission> AdminPermissions => Set<AdminPermission>();

    public DbSet<AdminUserRole> AdminUserRoles => Set<AdminUserRole>();

    public DbSet<AdminRolePermission> AdminRolePermissions => Set<AdminRolePermission>();

    public DbSet<AdminSession> AdminSessions => Set<AdminSession>();

    public DbSet<AdminAuditLog> AdminAuditLogs => Set<AdminAuditLog>();

    public DbSet<RaceRuleConfig> RaceRuleConfigs => Set<RaceRuleConfig>();

    public DbSet<HorseCatalog> HorseCatalogs => Set<HorseCatalog>();

    public DbSet<CharacterCatalog> CharacterCatalogs => Set<CharacterCatalog>();

    public DbSet<CosmeticCatalog> CosmeticCatalogs => Set<CosmeticCatalog>();

    public DbSet<CharacterLevelConfig> CharacterLevelConfigs => Set<CharacterLevelConfig>();

    public DbSet<ItemCatalog> ItemCatalogs => Set<ItemCatalog>();

    public DbSet<PlayerCharacter> PlayerCharacters => Set<PlayerCharacter>();

    public DbSet<PlayerCosmetic> PlayerCosmetics => Set<PlayerCosmetic>();

    public DbSet<PlayerItem> PlayerItems => Set<PlayerItem>();

    public DbSet<PlayerItemTransaction> PlayerItemTransactions => Set<PlayerItemTransaction>();

    public DbSet<ShopProduct> ShopProducts => Set<ShopProduct>();

    public DbSet<ShopOrder> ShopOrders => Set<ShopOrder>();

    public DbSet<ShopOrderDelivery> ShopOrderDeliveries => Set<ShopOrderDelivery>();

    public DbSet<DailyTaskDefinition> DailyTaskDefinitions => Set<DailyTaskDefinition>();

    public DbSet<PlayerDailyTask> PlayerDailyTasks => Set<PlayerDailyTask>();

    public DbSet<DailyTaskClaim> DailyTaskClaims => Set<DailyTaskClaim>();

    public DbSet<Notice> Notices => Set<Notice>();

    public DbSet<PlayerNoticeRead> PlayerNoticeReads => Set<PlayerNoticeRead>();

    public DbSet<PlayerStat> PlayerStats => Set<PlayerStat>();

    public DbSet<PlayerReliefGrant> PlayerReliefGrants => Set<PlayerReliefGrant>();

    public DbSet<WalletAdjustmentRequest> WalletAdjustmentRequests => Set<WalletAdjustmentRequest>();

    public DbSet<WalletAdjustmentApproval> WalletAdjustmentApprovals => Set<WalletAdjustmentApproval>();

    public DbSet<RaceRound> RaceRounds => Set<RaceRound>();

    public DbSet<RaceHorse> RaceHorses => Set<RaceHorse>();

    public DbSet<RaceBetSelection> RaceBetSelections => Set<RaceBetSelection>();

    public DbSet<BetOrder> BetOrders => Set<BetOrder>();

    public DbSet<RaceRoundStateLog> RaceRoundStateLogs => Set<RaceRoundStateLog>();

    public DbSet<RaceSettlementRun> RaceSettlementRuns => Set<RaceSettlementRun>();

    public DbSet<BetOrderSettlementLog> BetOrderSettlementLogs => Set<BetOrderSettlementLog>();

    public DbSet<JobExecutionLog> JobExecutionLogs => Set<JobExecutionLog>();

    public DbSet<RaceLog> RaceLogs => Set<RaceLog>();

    public DbSet<HorseLog> HorseLogs => Set<HorseLog>();

    public DbSet<CharacterLog> CharacterLogs => Set<CharacterLog>();

    public DbSet<AchievementDefinition> AchievementDefinitions => Set<AchievementDefinition>();

    public DbSet<PlayerAchievement> PlayerAchievements => Set<PlayerAchievement>();

    public DbSet<PlayerReferralReward> PlayerReferralRewards => Set<PlayerReferralReward>();
    public DbSet<JackpotPool> JackpotPools => Set<JackpotPool>();
    public DbSet<JackpotDropLog> JackpotDropLogs => Set<JackpotDropLog>();
    public DbSet<PlayerHorseStable> PlayerHorseStables => Set<PlayerHorseStable>();
    public DbSet<HorseDividend> HorseDividends => Set<HorseDividend>();
    public DbSet<RanchHorse> RanchHorses => Set<RanchHorse>();
    public DbSet<RanchEquipmentItem> RanchEquipmentItems => Set<RanchEquipmentItem>();
    public DbSet<RanchHorseEquipment> RanchHorseEquipments => Set<RanchHorseEquipment>();
    public DbSet<RanchFeedLog> RanchFeedLogs => Set<RanchFeedLog>();
    public DbSet<RanchTrainingLog> RanchTrainingLogs => Set<RanchTrainingLog>();
    public DbSet<RanchQualificationTrial> RanchQualificationTrials => Set<RanchQualificationTrial>();
    public DbSet<BackgroundJob> BackgroundJobs => Set<BackgroundJob>();
    public DbSet<RaceEnvironment> RaceEnvironments => Set<RaceEnvironment>();
    public DbSet<RaceCommentaryTemplate> RaceCommentaryTemplates => Set<RaceCommentaryTemplate>();
    public DbSet<RaceTipsterTemplate> RaceTipsterTemplates => Set<RaceTipsterTemplate>();
    public DbSet<RanchFoalTier> RanchFoalTiers => Set<RanchFoalTier>();
    public DbSet<RanchFeedCatalog> RanchFeedCatalogs => Set<RanchFeedCatalog>();
    public DbSet<RanchTrainingCatalog> RanchTrainingCatalogs => Set<RanchTrainingCatalog>();
    public DbSet<RanchCareCatalog> RanchCareCatalogs => Set<RanchCareCatalog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Player>(entity =>
        {
            entity.ToTable("players");
            entity.HasIndex(x => x.AccountId).IsUnique();
            entity.HasIndex(x => x.AccountNormalized).IsUnique();
            entity.HasIndex(x => x.InviteCode).IsUnique().HasDatabaseName("idx_players_invite_code");
            entity.Property(x => x.AccountId).HasMaxLength(64);
            entity.Property(x => x.AccountNormalized).HasMaxLength(64);
            entity.Property(x => x.Nickname).HasMaxLength(64);
            entity.Property(x => x.AvatarAsset).HasMaxLength(256);
            entity.Property(x => x.Locale).HasMaxLength(16);
            entity.Property(x => x.InviteCode).HasMaxLength(16);
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.ReferredByPlayerId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<PlayerCredential>(entity =>
        {
            entity.ToTable("player_credentials");
            entity.HasIndex(x => x.PlayerId).IsUnique();
            entity.Property(x => x.PasswordHash).HasMaxLength(512);
            entity.Property(x => x.PasswordAlgorithm).HasMaxLength(32);
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PlayerSession>(entity =>
        {
            entity.ToTable("player_sessions");
            entity.HasIndex(x => x.RefreshTokenHash).IsUnique();
            entity.HasIndex(x => x.AccessTokenJti).IsUnique();
            entity.HasIndex(x => new { x.PlayerId, x.RevokedAt, x.ExpiresAt })
                .HasDatabaseName("idx_player_sessions_player_active");
            entity.Property(x => x.RefreshTokenHash).HasMaxLength(256);
            entity.Property(x => x.AccessTokenJti).HasMaxLength(128);
            entity.Property(x => x.ClientPlatform).HasMaxLength(32);
            entity.Property(x => x.ClientVersion).HasMaxLength(32);
            entity.Property(x => x.DeviceId).HasMaxLength(128);
            entity.Property(x => x.ClientIp).HasMaxLength(64);
            entity.Property(x => x.UserAgent).HasMaxLength(512);
            entity.Property(x => x.RevokeReason).HasMaxLength(64);
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PlayerSetting>(entity =>
        {
            entity.ToTable("player_settings");
            entity.HasIndex(x => x.PlayerId).IsUnique();
            entity.Property(x => x.Language).HasMaxLength(16);
            entity.Property(x => x.TimeZone).HasMaxLength(64);
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PlayerAuthAuditLog>(entity =>
        {
            entity.ToTable("player_auth_audit_logs");
            entity.HasIndex(x => new { x.AccountNormalized, x.CreatedAt })
                .HasDatabaseName("idx_player_auth_audit_logs_account_created_at");
            entity.HasIndex(x => new { x.PlayerId, x.CreatedAt })
                .HasDatabaseName("idx_player_auth_audit_logs_player_created_at");
            entity.Property(x => x.AccountNormalized).HasMaxLength(64);
            entity.Property(x => x.ActionType).HasMaxLength(32);
            entity.Property(x => x.Outcome).HasMaxLength(32);
            entity.Property(x => x.FailureCode).HasMaxLength(64);
            entity.Property(x => x.RequestId).HasMaxLength(128);
            entity.Property(x => x.ClientIp).HasMaxLength(64);
            entity.Property(x => x.UserAgent).HasMaxLength(512);
            entity.Property(x => x.MetadataJson).HasColumnType("jsonb");
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Wallet>(entity =>
        {
            entity.ToTable("wallets");
            entity.HasIndex(x => x.PlayerId).IsUnique();
            entity.Property(x => x.Balance).HasPrecision(20, 2);
            entity.Property(x => x.FrozenBalance).HasPrecision(20, 2);
            entity.Property(x => x.Version).IsConcurrencyToken();
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WalletTransaction>(entity =>
        {
            entity.ToTable("wallet_transactions");
            entity.HasIndex(x => x.IdempotencyKey).IsUnique();
            entity.HasIndex(x => new { x.PlayerId, x.CreatedAt })
                .HasDatabaseName("idx_wallet_transactions_player_created_at");
            entity.HasIndex(x => new { x.PlayerId, x.Id })
                .HasDatabaseName("idx_wallet_transactions_player_id_desc");
            entity.HasIndex(x => new { x.ReferenceType, x.ReferenceId })
                .HasDatabaseName("idx_wallet_transactions_reference");
            entity.Property(x => x.TransactionType).HasMaxLength(32);
            entity.Property(x => x.Amount).HasPrecision(20, 2);
            entity.Property(x => x.BalanceBefore).HasPrecision(20, 2);
            entity.Property(x => x.BalanceAfter).HasPrecision(20, 2);
            entity.Property(x => x.FeeRate).HasPrecision(10, 6);
            entity.Property(x => x.FeeAmount).HasPrecision(20, 2);
            entity.Property(x => x.ReferenceType).HasMaxLength(32);
            entity.Property(x => x.ReferenceId).HasMaxLength(128);
            entity.Property(x => x.RequestId).HasMaxLength(128);
            entity.Property(x => x.IdempotencyKey).HasMaxLength(128);
            entity.Property(x => x.MetadataJson).HasColumnType("jsonb");
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AdminUser>(entity =>
        {
            entity.ToTable("admin_users");
            entity.HasIndex(x => x.Username).IsUnique();
            entity.HasIndex(x => x.UsernameNormalized).IsUnique();
            entity.Property(x => x.Username).HasMaxLength(64);
            entity.Property(x => x.UsernameNormalized).HasMaxLength(64);
            entity.Property(x => x.PasswordHash).HasMaxLength(512);
            entity.Property(x => x.PasswordAlgorithm).HasMaxLength(32);
        });

        modelBuilder.Entity<AdminRole>(entity =>
        {
            entity.ToTable("admin_roles");
            entity.HasIndex(x => x.RoleCode).IsUnique();
            entity.Property(x => x.RoleCode).HasMaxLength(64);
            entity.Property(x => x.RoleName).HasMaxLength(64);
        });

        modelBuilder.Entity<AdminPermission>(entity =>
        {
            entity.ToTable("admin_permissions");
            entity.HasIndex(x => x.PermissionCode).IsUnique();
            entity.Property(x => x.PermissionCode).HasMaxLength(128);
            entity.Property(x => x.PermissionName).HasMaxLength(128);
            entity.Property(x => x.ResourceType).HasMaxLength(64);
            entity.Property(x => x.ActionType).HasMaxLength(32);
        });

        modelBuilder.Entity<AdminUserRole>(entity =>
        {
            entity.ToTable("admin_user_roles");
            entity.HasIndex(x => new { x.AdminUserId, x.AdminRoleId }).IsUnique();
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.AdminUserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<AdminRole>()
                .WithMany()
                .HasForeignKey(x => x.AdminRoleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AdminRolePermission>(entity =>
        {
            entity.ToTable("admin_role_permissions");
            entity.HasIndex(x => new { x.AdminRoleId, x.AdminPermissionId }).IsUnique();
            entity.HasOne<AdminRole>()
                .WithMany()
                .HasForeignKey(x => x.AdminRoleId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<AdminPermission>()
                .WithMany()
                .HasForeignKey(x => x.AdminPermissionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AdminSession>(entity =>
        {
            entity.ToTable("admin_sessions");
            entity.HasIndex(x => x.RefreshTokenHash).IsUnique();
            entity.HasIndex(x => x.AccessTokenJti).IsUnique();
            entity.HasIndex(x => new { x.AdminUserId, x.RevokedAt, x.ExpiresAt })
                .HasDatabaseName("idx_admin_sessions_admin_active");
            entity.Property(x => x.RefreshTokenHash).HasMaxLength(256);
            entity.Property(x => x.AccessTokenJti).HasMaxLength(128);
            entity.Property(x => x.ClientIp).HasMaxLength(64);
            entity.Property(x => x.UserAgent).HasMaxLength(512);
            entity.Property(x => x.RevokeReason).HasMaxLength(64);
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.AdminUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AdminAuditLog>(entity =>
        {
            entity.ToTable("admin_audit_logs");
            entity.HasIndex(x => x.CreatedAt).HasDatabaseName("idx_admin_audit_logs_created_at");
            entity.HasIndex(x => new { x.ResourceType, x.ResourceId, x.CreatedAt })
                .HasDatabaseName("idx_admin_audit_logs_resource");
            entity.Property(x => x.ActionType).HasMaxLength(64);
            entity.Property(x => x.ResourceType).HasMaxLength(64);
            entity.Property(x => x.ResourceId).HasMaxLength(128);
            entity.Property(x => x.RequestId).HasMaxLength(128);
            entity.Property(x => x.BeforeJson).HasColumnType("jsonb");
            entity.Property(x => x.AfterJson).HasColumnType("jsonb");
            entity.Property(x => x.MetadataJson).HasColumnType("jsonb");
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.AdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<RaceRuleConfig>(entity =>
        {
            entity.ToTable("race_rule_configs");
            entity.HasIndex(x => new { x.ConfigCode, x.Version }).IsUnique();
            entity.HasIndex(x => new { x.IsActive, x.IsPublished, x.EffectiveStartAt, x.EffectiveEndAt })
                .HasDatabaseName("idx_race_rule_configs_active_window");
            entity.Property(x => x.ConfigCode).HasMaxLength(64);
            entity.Property(x => x.MinBetAmount).HasPrecision(20, 2);
            entity.Property(x => x.InitialWalletBalance).HasPrecision(20, 2);
            entity.Property(x => x.PostRaceIntervalSeconds);
            entity.Property(x => x.OddsAlgorithmVersion).HasMaxLength(32);
            entity.Property(x => x.ResultAlgorithmVersion).HasMaxLength(32);
            entity.Property(x => x.BlackHorseAlgorithmVersion).HasMaxLength(32);
            entity.Property(x => x.RoundingVersion).HasMaxLength(32);
            entity.Property(x => x.FeeScheduleJson).HasColumnType("jsonb");
            entity.Property(x => x.ConfigPayloadJson).HasColumnType("jsonb");
            entity.Property(x => x.MaintenanceReason).HasMaxLength(256);
            entity.Property(x => x.MaxRoundPayoutLiability).HasPrecision(20, 2);
            entity.Property(x => x.ReferralCommissionRate).HasPrecision(10, 6);
            entity.Property(x => x.PhotoFinishThresholdSeconds).HasPrecision(6, 4);
            entity.Property(x => x.JackpotPoolCode).HasMaxLength(32);
            entity.Property(x => x.JackpotContributionRate).HasPrecision(6, 4);
            entity.Property(x => x.JackpotSeedAmount).HasPrecision(18, 2);
            entity.Property(x => x.JackpotWinnerShareRate).HasPrecision(6, 4);
            entity.Property(x => x.JackpotRainShareRate).HasPrecision(6, 4);
            entity.Property(x => x.JackpotRainMinBetAmount).HasPrecision(18, 2);
            entity.Property(x => x.PhotoFinishLeadSeconds).HasPrecision(4, 2);
            entity.Property(x => x.JackpotMinTriggerOdds).HasPrecision(10, 2);
            entity.Property(x => x.InPlayBoostProfitRate).HasPrecision(6, 4);
            entity.Property(x => x.PayoutQuinellaRatio).HasPrecision(6, 4);
            entity.Property(x => x.PayoutPlaceRatio).HasPrecision(6, 4);
            entity.Property(x => x.PayoutExactaRatio).HasPrecision(6, 4);
            entity.Property(x => x.BlackHorseBoostMultiplier).HasPrecision(5, 2);
            entity.Property(x => x.PhotoFinishProbability).HasPrecision(5, 4);
            entity.Property(x => x.ScoreWeightsJson).HasColumnType("jsonb");
            entity.Property(x => x.StableDividendScheduleJson).HasColumnType("jsonb");
            entity.Property(x => x.PlayTypeOddsCoefficientsJson).HasColumnType("jsonb");
            entity.Property(x => x.QualificationTrialBenchmark).HasPrecision(6, 3);
            entity.Property(x => x.QualificationTrialBaseTime).HasPrecision(6, 3);
            entity.Property(x => x.QualificationLicenseFee).HasPrecision(18, 2);
            entity.Property(x => x.SystemBuybackConfigJson).HasColumnType("jsonb");
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.CreatedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.UpdatedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<HorseCatalog>(entity =>
        {
            entity.ToTable("horse_catalogs");
            entity.HasIndex(x => x.HorseCode).IsUnique();
            entity.HasIndex(x => x.IsEnabled).HasDatabaseName("idx_horse_catalogs_enabled");
            entity.Property(x => x.HorseCode).HasMaxLength(64);
            entity.Property(x => x.NameZh).HasMaxLength(128);
            entity.Property(x => x.NameEn).HasMaxLength(128);
            entity.Property(x => x.AvatarAsset).HasMaxLength(256);
            entity.Property(x => x.PortraitAsset).HasMaxLength(256);
            entity.Property(x => x.MetadataJson).HasColumnType("jsonb");
            entity.Property(x => x.WinRate).HasPrecision(10, 6);
            entity.Property(x => x.Rank1Probability).HasPrecision(10, 6);
            entity.Property(x => x.Rank2Probability).HasPrecision(10, 6);
            entity.Property(x => x.Rank3Probability).HasPrecision(10, 6);
            entity.Property(x => x.Rank4Probability).HasPrecision(10, 6);
            entity.Property(x => x.Rank5Probability).HasPrecision(10, 6);
            entity.Property(x => x.Rank6Probability).HasPrecision(10, 6);
            entity.Property(x => x.PreferredTrack).HasMaxLength(32);
            entity.Property(x => x.PreferredWeather).HasMaxLength(32);
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.CreatedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.UpdatedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<CharacterCatalog>(entity =>
        {
            entity.ToTable("character_catalogs");
            entity.HasIndex(x => x.CharacterCode).IsUnique();
            entity.Property(x => x.CharacterCode).HasMaxLength(64);
            entity.Property(x => x.NameZh).HasMaxLength(128);
            entity.Property(x => x.NameEn).HasMaxLength(128);
            entity.Property(x => x.AvatarAsset).HasMaxLength(256);
            entity.Property(x => x.PortraitAsset).HasMaxLength(256);
            entity.Property(x => x.MetadataJson).HasColumnType("jsonb");
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.CreatedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.UpdatedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<CosmeticCatalog>(entity =>
        {
            entity.ToTable("cosmetic_catalogs");
            entity.HasIndex(x => x.CosmeticCode).IsUnique();
            entity.HasIndex(x => new { x.IsEnabled, x.SlotType, x.SortOrder, x.Id })
                .HasDatabaseName("idx_cosmetic_catalogs_enabled_slot_sort_order");
            entity.Property(x => x.CosmeticCode).HasMaxLength(64);
            entity.Property(x => x.SlotType).HasMaxLength(32);
            entity.Property(x => x.NameZh).HasMaxLength(128);
            entity.Property(x => x.NameEn).HasMaxLength(128);
            entity.Property(x => x.IconAsset).HasMaxLength(256);
            entity.Property(x => x.PreviewAsset).HasMaxLength(256);
            entity.Property(x => x.MetadataJson).HasColumnType("jsonb");
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.CreatedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.UpdatedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<CharacterLevelConfig>(entity =>
        {
            entity.ToTable("character_level_configs");
            entity.HasIndex(x => new { x.CharacterId, x.Level }).IsUnique();
            entity.Property(x => x.RewardType).HasMaxLength(32);
            entity.Property(x => x.RewardPayload).HasColumnType("jsonb");
            entity.HasOne<CharacterCatalog>()
                .WithMany()
                .HasForeignKey(x => x.CharacterId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.CreatedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.UpdatedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ItemCatalog>(entity =>
        {
            entity.ToTable("item_catalogs");
            entity.HasIndex(x => x.ItemCode).IsUnique();
            entity.Property(x => x.ItemCode).HasMaxLength(64);
            entity.Property(x => x.ItemType).HasMaxLength(32);
            entity.Property(x => x.NameZh).HasMaxLength(128);
            entity.Property(x => x.NameEn).HasMaxLength(128);
            entity.Property(x => x.IconAsset).HasMaxLength(256);
            entity.Property(x => x.MetadataJson).HasColumnType("jsonb");
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.CreatedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.UpdatedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<PlayerCharacter>(entity =>
        {
            entity.ToTable("player_characters");
            entity.HasIndex(x => new { x.PlayerId, x.CharacterId }).IsUnique();
            entity.HasIndex(x => new { x.PlayerId, x.IsEquipped })
                .HasDatabaseName("idx_player_characters_player_equipped");
            entity.HasIndex(x => x.PlayerId)
                .HasDatabaseName("ux_player_characters_one_equipped")
                .HasFilter("is_equipped = TRUE")
                .IsUnique();
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<CharacterCatalog>()
                .WithMany()
                .HasForeignKey(x => x.CharacterId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PlayerCosmetic>(entity =>
        {
            entity.ToTable("player_cosmetics");
            entity.HasIndex(x => new { x.PlayerId, x.CosmeticId }).IsUnique();
            entity.HasIndex(x => new { x.PlayerId, x.SlotType, x.IsEquipped })
                .HasDatabaseName("idx_player_cosmetics_player_slot_equipped");
            entity.HasIndex(x => new { x.PlayerId, x.SlotType })
                .HasDatabaseName("ux_player_cosmetics_one_equipped_per_slot")
                .HasFilter("is_equipped = TRUE")
                .IsUnique();
            entity.Property(x => x.SlotType).HasMaxLength(32);
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<CosmeticCatalog>()
                .WithMany()
                .HasForeignKey(x => x.CosmeticId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PlayerItem>(entity =>
        {
            entity.ToTable("player_items");
            entity.HasIndex(x => new { x.PlayerId, x.ItemId }).IsUnique();
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ItemCatalog>()
                .WithMany()
                .HasForeignKey(x => x.ItemId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PlayerItemTransaction>(entity =>
        {
            entity.ToTable("player_item_transactions");
            entity.HasIndex(x => x.IdempotencyKey).IsUnique();
            entity.HasIndex(x => new { x.PlayerId, x.CreatedAt })
                .HasDatabaseName("idx_player_item_transactions_player_created_at");
            entity.Property(x => x.ChangeType).HasMaxLength(32);
            entity.Property(x => x.ReferenceType).HasMaxLength(32);
            entity.Property(x => x.ReferenceId).HasMaxLength(128);
            entity.Property(x => x.IdempotencyKey).HasMaxLength(128);
            entity.Property(x => x.MetadataJson).HasColumnType("jsonb");
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ItemCatalog>()
                .WithMany()
                .HasForeignKey(x => x.ItemId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ShopProduct>(entity =>
        {
            entity.ToTable("shop_products");
            entity.HasIndex(x => x.ProductCode).IsUnique();
            entity.Property(x => x.ProductCode).HasMaxLength(64);
            entity.Property(x => x.ProductType).HasMaxLength(32);
            entity.Property(x => x.CurrencyType).HasMaxLength(32);
            entity.Property(x => x.TitleZh).HasMaxLength(128);
            entity.Property(x => x.TitleEn).HasMaxLength(128);
            entity.Property(x => x.CashSkuCode).HasMaxLength(128);
            entity.Property(x => x.CoverAsset).HasMaxLength(256);
            entity.Property(x => x.PriceAmount).HasPrecision(20, 2);
            entity.Property(x => x.RewardPayload).HasColumnType("jsonb");
            entity.Property(x => x.MetadataJson).HasColumnType("jsonb");
            entity.HasOne<CharacterCatalog>()
                .WithMany()
                .HasForeignKey(x => x.CharacterId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<CosmeticCatalog>()
                .WithMany()
                .HasForeignKey(x => x.CosmeticId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<ItemCatalog>()
                .WithMany()
                .HasForeignKey(x => x.ItemId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.CreatedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.UpdatedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ShopOrder>(entity =>
        {
            entity.ToTable("shop_orders");
            entity.HasIndex(x => x.OrderNo).IsUnique();
            entity.HasIndex(x => x.IdempotencyKey).IsUnique();
            entity.HasIndex(x => new { x.PlayerId, x.CreatedAt })
                .HasDatabaseName("idx_shop_orders_player_created_at");
            entity.HasIndex(x => new { x.Status, x.CreatedAt })
                .HasDatabaseName("idx_shop_orders_status_created_at");
            entity.Property(x => x.OrderNo).HasMaxLength(64);
            entity.Property(x => x.ProductCodeSnapshot).HasMaxLength(64);
            entity.Property(x => x.ProductTypeSnapshot).HasMaxLength(32);
            entity.Property(x => x.CurrencyTypeSnapshot).HasMaxLength(32);
            entity.Property(x => x.TitleZhSnapshot).HasMaxLength(128);
            entity.Property(x => x.TitleEnSnapshot).HasMaxLength(128);
            entity.Property(x => x.UnitPriceAmount).HasPrecision(20, 2);
            entity.Property(x => x.TotalPriceAmount).HasPrecision(20, 2);
            entity.Property(x => x.Status).HasMaxLength(32);
            entity.Property(x => x.FailureCode).HasMaxLength(64);
            entity.Property(x => x.IdempotencyKey).HasMaxLength(128);
            entity.Property(x => x.RequestHash).HasMaxLength(64);
            entity.Property(x => x.RequestPayloadJson).HasColumnType("jsonb");
            entity.Property(x => x.ResultPayloadJson).HasColumnType("jsonb");
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ShopProduct>()
                .WithMany()
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<WalletTransaction>()
                .WithMany()
                .HasForeignKey(x => x.PaymentTransactionId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ShopOrderDelivery>(entity =>
        {
            entity.ToTable("shop_order_deliveries");
            entity.HasIndex(x => new { x.ShopOrderId, x.CreatedAt })
                .HasDatabaseName("idx_shop_order_deliveries_order_created_at");
            entity.Property(x => x.DeliveryType).HasMaxLength(32);
            entity.Property(x => x.DeliveryStatus).HasMaxLength(32);
            entity.Property(x => x.FailureCode).HasMaxLength(64);
            entity.Property(x => x.PayloadJson).HasColumnType("jsonb");
            entity.HasOne<ShopOrder>()
                .WithMany()
                .HasForeignKey(x => x.ShopOrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<PlayerItemTransaction>()
                .WithMany()
                .HasForeignKey(x => x.ItemTransactionId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<WalletTransaction>()
                .WithMany()
                .HasForeignKey(x => x.WalletTransactionId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<PlayerCharacter>()
                .WithMany()
                .HasForeignKey(x => x.PlayerCharacterId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<PlayerCosmetic>()
                .WithMany()
                .HasForeignKey(x => x.PlayerCosmeticId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<DailyTaskDefinition>(entity =>
        {
            entity.ToTable("daily_task_definitions");
            entity.HasIndex(x => x.TaskCode).IsUnique();
            entity.Property(x => x.TaskCode).HasMaxLength(64);
            entity.Property(x => x.TaskType).HasMaxLength(32);
            entity.Property(x => x.TitleZh).HasMaxLength(128);
            entity.Property(x => x.TitleEn).HasMaxLength(128);
            entity.Property(x => x.ConditionPayloadJson).HasColumnType("jsonb");
            entity.Property(x => x.RewardType).HasMaxLength(32);
            entity.Property(x => x.RewardPayload).HasColumnType("jsonb");
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.CreatedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.UpdatedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<PlayerDailyTask>(entity =>
        {
            entity.ToTable("player_daily_tasks");
            entity.HasIndex(x => new { x.PlayerId, x.BusinessDate })
                .HasDatabaseName("idx_player_daily_tasks_player_date");
            entity.HasIndex(x => new { x.PlayerId, x.TaskDefinitionId, x.BusinessDate }).IsUnique();
            entity.Property(x => x.BusinessDate).HasColumnType("date");
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<DailyTaskDefinition>()
                .WithMany()
                .HasForeignKey(x => x.TaskDefinitionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DailyTaskClaim>(entity =>
        {
            entity.ToTable("daily_task_claims");
            entity.HasIndex(x => x.IdempotencyKey).IsUnique();
            entity.HasIndex(x => new { x.PlayerId, x.BusinessDate, x.CreatedAt })
                .HasDatabaseName("idx_daily_task_claims_player_date");
            entity.Property(x => x.BusinessDate).HasColumnType("date");
            entity.Property(x => x.ClaimStatus).HasMaxLength(32);
            entity.Property(x => x.RewardTypeSnapshot).HasMaxLength(32);
            entity.Property(x => x.RewardPayloadSnapshot).HasColumnType("jsonb");
            entity.Property(x => x.IdempotencyKey).HasMaxLength(128);
            entity.Property(x => x.FailureCode).HasMaxLength(64);
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<PlayerDailyTask>()
                .WithMany()
                .HasForeignKey(x => x.PlayerDailyTaskId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<WalletTransaction>()
                .WithMany()
                .HasForeignKey(x => x.WalletTransactionId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<PlayerItemTransaction>()
                .WithMany()
                .HasForeignKey(x => x.ItemTransactionId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Notice>(entity =>
        {
            entity.ToTable("notices");
            entity.HasIndex(x => x.NoticeCode).IsUnique();
            entity.HasIndex(x => new { x.IsPublished, x.StartAt, x.EndAt })
                .HasDatabaseName("idx_notices_published_window");
            entity.Property(x => x.NoticeCode).HasMaxLength(64);
            entity.Property(x => x.TitleZh).HasMaxLength(256);
            entity.Property(x => x.TitleEn).HasMaxLength(256);
            entity.Property(x => x.NoticeType).HasMaxLength(32);
            entity.Property(x => x.TargetPayloadJson).HasColumnType("jsonb");
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.CreatedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.UpdatedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<PlayerNoticeRead>(entity =>
        {
            entity.ToTable("player_notice_reads");
            entity.HasIndex(x => new { x.PlayerId, x.NoticeId }).IsUnique();
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Notice>()
                .WithMany()
                .HasForeignKey(x => x.NoticeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PlayerStat>(entity =>
        {
            entity.ToTable("player_stats");
            entity.HasIndex(x => x.PlayerId).IsUnique();
            entity.HasIndex(x => new { x.WinRate, x.TotalRoundsWon })
                .HasDatabaseName("idx_player_stats_win_rate");
            entity.Property(x => x.WinRate).HasPrecision(10, 6);
            entity.Property(x => x.TotalBetAmount).HasPrecision(20, 2);
            entity.Property(x => x.TotalGrossReward).HasPrecision(20, 2);
            entity.Property(x => x.TotalFeeAmount).HasPrecision(20, 2);
            entity.Property(x => x.TotalNetReward).HasPrecision(20, 2);
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PlayerReliefGrant>(entity =>
        {
            entity.ToTable("player_relief_grants");
            entity.HasIndex(x => x.IdempotencyKey).IsUnique();
            entity.HasIndex(x => new { x.PlayerId, x.BusinessDate, x.Status })
                .HasDatabaseName("idx_player_relief_grants_player_date_status");
            entity.HasIndex(x => new { x.Status, x.GrantAt })
                .HasDatabaseName("idx_player_relief_grants_status_grant_at");
            entity.Property(x => x.BusinessDate).HasColumnType("date");
            entity.Property(x => x.Amount).HasPrecision(20, 2);
            entity.Property(x => x.Status).HasMaxLength(32);
            entity.Property(x => x.IdempotencyKey).HasMaxLength(128);
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<WalletTransaction>()
                .WithMany()
                .HasForeignKey(x => x.TriggerTransactionId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<WalletTransaction>()
                .WithMany()
                .HasForeignKey(x => x.GrantedTransactionId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<WalletAdjustmentRequest>(entity =>
        {
            entity.ToTable("wallet_adjustment_requests");
            entity.HasIndex(x => x.RequestNo).IsUnique();
            entity.HasIndex(x => x.IdempotencyKey).IsUnique();
            entity.HasIndex(x => new { x.PlayerId, x.Status, x.CreatedAt })
                .HasDatabaseName("idx_wallet_adjustment_requests_player_status_created_at");
            entity.Property(x => x.RequestNo).HasMaxLength(64);
            entity.Property(x => x.AdjustmentType).HasMaxLength(32);
            entity.Property(x => x.AdjustmentAmount).HasPrecision(20, 2);
            entity.Property(x => x.BalanceBefore).HasPrecision(20, 2);
            entity.Property(x => x.BalanceAfter).HasPrecision(20, 2);
            entity.Property(x => x.Status).HasMaxLength(32);
            entity.Property(x => x.IdempotencyKey).HasMaxLength(128);
            entity.Property(x => x.RequestMetadataJson).HasColumnType("jsonb");
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.RequestedByAdminUserId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.ExecutedByAdminUserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<WalletTransaction>()
                .WithMany()
                .HasForeignKey(x => x.ExecutedTransactionId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<WalletAdjustmentApproval>(entity =>
        {
            entity.ToTable("wallet_adjustment_approvals");
            entity.Property(x => x.Decision).HasMaxLength(32);
            entity.HasOne<WalletAdjustmentRequest>()
                .WithMany()
                .HasForeignKey(x => x.RequestId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<AdminUser>()
                .WithMany()
                .HasForeignKey(x => x.AdminUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RaceRound>(entity =>
        {
            entity.ToTable("race_rounds");
            entity.HasIndex(x => x.RoundNo).IsUnique();
            entity.HasIndex(x => x.State).HasDatabaseName("idx_race_rounds_state");
            entity.Property(x => x.State).HasConversion<int>();
            entity.Property(x => x.RoundNo).HasMaxLength(32);
            entity.Property(x => x.TotalBetAmount).HasPrecision(20, 2);
            entity.Property(x => x.PayoutPoolAmount).HasPrecision(20, 2);
            entity.Property(x => x.DilutionFactor).HasPrecision(10, 6);
            entity.Property(x => x.PostRaceIntervalSeconds);
            entity.Property(x => x.OddsAlgorithmVersion).HasMaxLength(32);
            entity.Property(x => x.ResultAlgorithmVersion).HasMaxLength(32);
            entity.Property(x => x.BlackHorseAlgorithmVersion).HasMaxLength(32);
            entity.Property(x => x.SettlementVersion).HasMaxLength(32);
            entity.Property(x => x.ResultSeed).HasMaxLength(256);
            entity.Property(x => x.ResultSeedCommitment).HasMaxLength(256);
            entity.Property(x => x.SelectedHorseSnapshotJson).HasColumnType("jsonb");
            entity.Property(x => x.OddsSnapshotJson).HasColumnType("jsonb");
            entity.Property(x => x.QuinellaOddsSnapshotJson).HasColumnType("jsonb");
            entity.Property(x => x.BlackHorseSnapshotJson).HasColumnType("jsonb");
            entity.Property(x => x.ResultJson).HasColumnType("jsonb");
            entity.Property(x => x.RoundRuleSnapshotJson).HasColumnType("jsonb");
            entity.Property(x => x.Weather).HasMaxLength(32);
            entity.Property(x => x.TrackType).HasMaxLength(32);
            entity.Property(x => x.PhotoFinishGapSeconds).HasPrecision(6, 4);
            entity.Property(x => x.CommentaryScriptJson).HasColumnType("jsonb");
            entity.Property(x => x.JackpotDropAmount).HasPrecision(18, 2);
        });

        modelBuilder.Entity<RaceHorse>(entity =>
        {
            entity.ToTable("race_horses");
            entity.HasIndex(x => new { x.RoundId, x.HorseNo }).IsUnique();
            entity.HasIndex(x => new { x.RoundId, x.HorseTemplateId }).IsUnique();
            entity.Property(x => x.HorseNameZhSnapshot).HasMaxLength(128);
            entity.Property(x => x.HorseNameEnSnapshot).HasMaxLength(128);
            entity.Property(x => x.AvatarAssetSnapshot).HasMaxLength(256);
            entity.Property(x => x.PortraitAssetSnapshot).HasMaxLength(256);
            entity.Property(x => x.Odds).HasPrecision(10, 6);
            entity.Property(x => x.WinRateSnapshot).HasPrecision(10, 6);
            entity.Property(x => x.Rank1ProbabilitySnapshot).HasPrecision(10, 6);
            entity.Property(x => x.Rank2ProbabilitySnapshot).HasPrecision(10, 6);
            entity.Property(x => x.Rank3ProbabilitySnapshot).HasPrecision(10, 6);
            entity.Property(x => x.Rank4ProbabilitySnapshot).HasPrecision(10, 6);
            entity.Property(x => x.Rank5ProbabilitySnapshot).HasPrecision(10, 6);
            entity.Property(x => x.Rank6ProbabilitySnapshot).HasPrecision(10, 6);
            entity.Property(x => x.FinishTime).HasPrecision(10, 4);
            entity.Property(x => x.AnimationJson).HasColumnType("jsonb");
            entity.HasOne<RaceRound>()
                .WithMany(x => x.Horses)
                .HasForeignKey(x => x.RoundId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<HorseCatalog>()
                .WithMany()
                .HasForeignKey(x => x.HorseTemplateId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RaceBetSelection>(entity =>
        {
            entity.ToTable("race_bet_selections");
            entity.HasIndex(x => new { x.PlayerId, x.RoundId, x.HorseNo }).IsUnique();
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<RaceRound>()
                .WithMany()
                .HasForeignKey(x => x.RoundId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BetOrder>(entity =>
        {
            entity.ToTable("bet_orders");
            entity.HasIndex(x => x.OrderNo).IsUnique();
            entity.HasIndex(x => x.IdempotencyKey).IsUnique();
            entity.HasIndex(x => new { x.PlayerId, x.CreatedAt })
                .HasDatabaseName("idx_bet_orders_player_created_at");
            entity.HasIndex(x => x.RoundId)
                .HasDatabaseName("idx_bet_orders_round_id");
            entity.HasIndex(x => new { x.RoundId, x.Status })
                .HasDatabaseName("idx_bet_orders_round_status");
            entity.HasIndex(x => new { x.RoundId, x.PlayType })
                .HasDatabaseName("idx_bet_orders_round_play_type");
            entity.Property(x => x.OrderNo).HasMaxLength(64);
            entity.Property(x => x.PlayType).HasMaxLength(32);
            entity.Property(x => x.Combination).HasMaxLength(16);
            entity.Property(x => x.Status).HasConversion<int>();
            entity.Property(x => x.StatusReason).HasMaxLength(128);
            entity.Property(x => x.DilutionFactor).HasPrecision(10, 6);
            entity.Property(x => x.BetAmount).HasPrecision(20, 2);
            entity.Property(x => x.DoubleDownAmount).HasPrecision(20, 2);
            entity.Property(x => x.LockedOdds).HasPrecision(10, 6);
            entity.Property(x => x.PotentialReward).HasPrecision(20, 2);
            entity.Property(x => x.GrossReward).HasPrecision(20, 2);
            entity.Property(x => x.FeeRate).HasPrecision(10, 6);
            entity.Property(x => x.FeeAmount).HasPrecision(20, 2);
            entity.Property(x => x.NetReward).HasPrecision(20, 2);
            entity.Property(x => x.RoundingVersion).HasMaxLength(32);
            entity.Property(x => x.IdempotencyKey).HasMaxLength(128);
            entity.Property(x => x.RequestHash).HasMaxLength(64);
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<RaceRound>()
                .WithMany()
                .HasForeignKey(x => x.RoundId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<WalletTransaction>()
                .WithMany()
                .HasForeignKey(x => x.RefundTransactionId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<RaceRoundStateLog>(entity =>
        {
            entity.ToTable("race_round_state_logs");
            entity.HasIndex(x => new { x.RoundId, x.CreatedAt })
                .HasDatabaseName("idx_race_round_state_logs_round_created_at");
            entity.Property(x => x.TriggerSource).HasMaxLength(32);
            entity.Property(x => x.ExecutionStatus).HasMaxLength(32);
            entity.Property(x => x.RequestId).HasMaxLength(128);
            entity.Property(x => x.MetadataJson).HasColumnType("jsonb");
            entity.HasOne<RaceRound>()
                .WithMany()
                .HasForeignKey(x => x.RoundId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RaceSettlementRun>(entity =>
        {
            entity.ToTable("race_settlement_runs");
            entity.HasIndex(x => x.ExecutionKey).IsUnique();
            entity.HasIndex(x => new { x.RoundId, x.StartedAt })
                .HasDatabaseName("idx_race_settlement_runs_round_started_at");
            entity.Property(x => x.RunStatus).HasMaxLength(32);
            entity.Property(x => x.RunReason).HasMaxLength(128);
            entity.Property(x => x.ExecutionKey).HasMaxLength(128);
            entity.Property(x => x.MetadataJson).HasColumnType("jsonb");
            entity.HasOne<RaceRound>()
                .WithMany()
                .HasForeignKey(x => x.RoundId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BetOrderSettlementLog>(entity =>
        {
            entity.ToTable("bet_order_settlement_logs");
            entity.HasIndex(x => new { x.BetOrderId, x.CreatedAt })
                .HasDatabaseName("idx_bet_order_settlement_logs_order_created_at");
            entity.Property(x => x.ResultStatus).HasMaxLength(32);
            entity.Property(x => x.GrossRewardSnapshot).HasPrecision(20, 2);
            entity.Property(x => x.FeeRateSnapshot).HasPrecision(10, 6);
            entity.Property(x => x.FeeAmountSnapshot).HasPrecision(20, 2);
            entity.Property(x => x.NetRewardSnapshot).HasPrecision(20, 2);
            entity.Property(x => x.MetadataJson).HasColumnType("jsonb");
            entity.HasOne<BetOrder>()
                .WithMany()
                .HasForeignKey(x => x.BetOrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<RaceSettlementRun>()
                .WithMany()
                .HasForeignKey(x => x.SettlementRunId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<WalletTransaction>()
                .WithMany()
                .HasForeignKey(x => x.RewardTransactionId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<WalletTransaction>()
                .WithMany()
                .HasForeignKey(x => x.FeeTransactionId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<RaceLog>(entity =>
        {
            entity.ToTable("race_logs");
            entity.HasIndex(x => new { x.RoundId, x.CreatedAt })
                .HasDatabaseName("idx_race_logs_round_created_at");
            entity.HasIndex(x => new { x.EventType, x.CreatedAt })
                .HasDatabaseName("idx_race_logs_event_created_at");
            entity.Property(x => x.RoundNo).HasMaxLength(32);
            entity.Property(x => x.EventType).HasMaxLength(64);
            entity.Property(x => x.ExecutionStatus).HasMaxLength(32);
            entity.Property(x => x.RequestId).HasMaxLength(128);
            entity.Property(x => x.PayloadJson).HasColumnType("jsonb");
            entity.HasOne<RaceRound>()
                .WithMany()
                .HasForeignKey(x => x.RoundId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<HorseLog>(entity =>
        {
            entity.ToTable("horse_logs");
            entity.HasIndex(x => new { x.RoundId, x.HorseNo, x.CreatedAt })
                .HasDatabaseName("idx_horse_logs_round_horse_created_at");
            entity.HasIndex(x => new { x.HorseTemplateId, x.CreatedAt })
                .HasDatabaseName("idx_horse_logs_template_created_at");
            entity.Property(x => x.EventType).HasMaxLength(64);
            entity.Property(x => x.ExecutionStatus).HasMaxLength(32);
            entity.Property(x => x.PayloadJson).HasColumnType("jsonb");
            entity.HasOne<RaceRound>()
                .WithMany()
                .HasForeignKey(x => x.RoundId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<RaceHorse>()
                .WithMany()
                .HasForeignKey(x => x.RaceHorseId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<HorseCatalog>()
                .WithMany()
                .HasForeignKey(x => x.HorseTemplateId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<CharacterLog>(entity =>
        {
            entity.ToTable("character_logs");
            entity.HasIndex(x => new { x.PlayerId, x.CreatedAt })
                .HasDatabaseName("idx_character_logs_player_created_at");
            entity.HasIndex(x => new { x.CharacterId, x.CreatedAt })
                .HasDatabaseName("idx_character_logs_character_created_at");
            entity.Property(x => x.EventType).HasMaxLength(64);
            entity.Property(x => x.ExecutionStatus).HasMaxLength(32);
            entity.Property(x => x.PayloadJson).HasColumnType("jsonb");
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<CharacterCatalog>()
                .WithMany()
                .HasForeignKey(x => x.CharacterId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<PlayerCharacter>()
                .WithMany()
                .HasForeignKey(x => x.PlayerCharacterId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<JobExecutionLog>(entity =>
        {
            entity.ToTable("job_execution_logs");
            entity.HasIndex(x => x.JobKey).IsUnique();
            entity.HasIndex(x => new { x.JobName, x.StartedAt })
                .HasDatabaseName("idx_job_execution_logs_job_started_at");
            entity.Property(x => x.JobName).HasMaxLength(128);
            entity.Property(x => x.JobKey).HasMaxLength(128);
            entity.Property(x => x.ScopeKey).HasMaxLength(128);
            entity.Property(x => x.RunStatus).HasMaxLength(32);
            entity.Property(x => x.OwnerInstance).HasMaxLength(128);
            entity.Property(x => x.MetadataJson).HasColumnType("jsonb");
        });

        modelBuilder.Entity<AchievementDefinition>(entity =>
        {
            entity.ToTable("achievement_definitions");
            entity.HasIndex(x => x.AchievementCode).IsUnique();
            entity.Property(x => x.AchievementCode).HasMaxLength(64);
            entity.Property(x => x.Category).HasMaxLength(32);
            entity.Property(x => x.TitleZh).HasMaxLength(128);
            entity.Property(x => x.TitleEn).HasMaxLength(128);
            entity.Property(x => x.DescriptionZh).HasMaxLength(256);
            entity.Property(x => x.DescriptionEn).HasMaxLength(256);
            entity.Property(x => x.IconAsset).HasMaxLength(256);
            entity.Property(x => x.BadgeName).HasMaxLength(64);
            entity.Property(x => x.RewardType).HasMaxLength(32);
            entity.Property(x => x.RewardPayload).HasColumnType("jsonb");
        });

        modelBuilder.Entity<PlayerAchievement>(entity =>
        {
            entity.ToTable("player_achievements");
            entity.HasIndex(x => new { x.PlayerId, x.AchievementId }).IsUnique();
            entity.HasIndex(x => x.IdempotencyKey).IsUnique();
            entity.HasIndex(x => x.PlayerId).HasDatabaseName("idx_player_achievements_player");
            entity.Property(x => x.IdempotencyKey).HasMaxLength(128);
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<AchievementDefinition>()
                .WithMany()
                .HasForeignKey(x => x.AchievementId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<WalletTransaction>()
                .WithMany()
                .HasForeignKey(x => x.WalletTransactionId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<PlayerReferralReward>(entity =>
        {
            entity.ToTable("player_referral_rewards");
            entity.HasIndex(x => x.IdempotencyKey).IsUnique();
            entity.HasIndex(x => new { x.ReferrerPlayerId, x.CreatedAt })
                .HasDatabaseName("idx_player_referral_rewards_referrer");
            entity.Property(x => x.RewardType).HasMaxLength(32);
            entity.Property(x => x.Amount).HasPrecision(20, 2);
            entity.Property(x => x.NetLossAmount).HasPrecision(20, 2);
            entity.Property(x => x.CommissionRate).HasPrecision(10, 6);
            entity.Property(x => x.Status).HasMaxLength(32);
            entity.Property(x => x.IdempotencyKey).HasMaxLength(128);
            entity.HasIndex(x => new { x.ReferrerPlayerId, x.Status })
                .HasDatabaseName("idx_player_referral_rewards_claim");
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.ReferrerPlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.InvitedPlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<RaceRound>()
                .WithMany()
                .HasForeignKey(x => x.RoundId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<WalletTransaction>()
                .WithMany()
                .HasForeignKey(x => x.WalletTransactionId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<WalletTransaction>()
                .WithMany()
                .HasForeignKey(x => x.ClaimTransactionId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<JackpotPool>(entity =>
        {
            entity.ToTable("jackpot_pools");
            entity.HasIndex(x => x.PoolCode).IsUnique();
            entity.Property(x => x.PoolCode).HasMaxLength(32);
            entity.Property(x => x.CurrentAmount).HasPrecision(18, 2);
            entity.Property(x => x.SeedAmount).HasPrecision(18, 2);
            entity.Property(x => x.TaxRate).HasPrecision(6, 4);
            entity.Property(x => x.TotalPaidOut).HasPrecision(18, 2);
        });

        modelBuilder.Entity<JackpotDropLog>(entity =>
        {
            entity.ToTable("jackpot_drop_logs");
            entity.HasIndex(x => x.RoundId).HasDatabaseName("idx_jackpot_drop_logs_round_id");
            entity.Property(x => x.PoolCode).HasMaxLength(32);
            entity.Property(x => x.TotalDropAmount).HasPrecision(18, 2);
            entity.Property(x => x.WinnerShareAmount).HasPrecision(18, 2);
            entity.Property(x => x.RainShareAmount).HasPrecision(18, 2);
            entity.Property(x => x.TriggerReason).HasMaxLength(64);
        });

        modelBuilder.Entity<PlayerHorseStable>(entity =>
        {
            entity.ToTable("player_horse_stables");
            entity.HasIndex(x => new { x.PlayerId, x.HorseCatalogId }).IsUnique();
            entity.Property(x => x.CustomName).HasMaxLength(64);
            entity.Property(x => x.AccumulatedPurse).HasPrecision(18, 2);
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<HorseCatalog>()
                .WithMany()
                .HasForeignKey(x => x.HorseCatalogId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<HorseDividend>(entity =>
        {
            entity.ToTable("horse_dividends");
            entity.HasIndex(x => new { x.PlayerId, x.Claimed }).HasDatabaseName("idx_horse_dividends_player_claimed");
            entity.Property(x => x.DividendAmount).HasPrecision(18, 2);
            entity.HasOne<RaceRound>()
                .WithMany()
                .HasForeignKey(x => x.RoundId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<HorseCatalog>()
                .WithMany()
                .HasForeignKey(x => x.HorseCatalogId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Player>()
                .WithMany()
                .HasForeignKey(x => x.PlayerId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RanchHorse>(entity =>
        {
            entity.ToTable("ranch_horses");
            entity.HasIndex(x => x.HorseCode).IsUnique();
            entity.HasIndex(x => x.OwnerPlayerId).HasDatabaseName("idx_ranch_horses_owner");
            entity.Property(x => x.HorseCode).HasMaxLength(32);
            entity.Property(x => x.CustomName).HasMaxLength(32);
            entity.Property(x => x.Gender).HasMaxLength(8);
            entity.Property(x => x.GrowthStage).HasMaxLength(16);
            entity.Property(x => x.PedigreeTier).HasMaxLength(24);
            entity.Property(x => x.CoatColor).HasMaxLength(16);
            entity.Property(x => x.RunningStyle).HasMaxLength(16);
            entity.Property(x => x.SpeedStat).HasPrecision(6, 2);
            entity.Property(x => x.SpeedPotential).HasPrecision(6, 2);
            entity.Property(x => x.StaminaStat).HasPrecision(6, 2);
            entity.Property(x => x.StaminaPotential).HasPrecision(6, 2);
            entity.Property(x => x.BurstStat).HasPrecision(6, 2);
            entity.Property(x => x.BurstPotential).HasPrecision(6, 2);
            entity.Property(x => x.AgilityStat).HasPrecision(6, 2);
            entity.Property(x => x.AgilityPotential).HasPrecision(6, 2);
            entity.Property(x => x.TemperamentStat).HasPrecision(6, 2);
            entity.Property(x => x.TemperamentPotential).HasPrecision(6, 2);
            entity.Property(x => x.QualificationTime).HasPrecision(6, 3);
            entity.Property(x => x.LicenseCertCode).HasMaxLength(48);
            entity.Property(x => x.AccumulatedPurse).HasPrecision(18, 2);
            entity.Property(x => x.SubStatus).HasMaxLength(24);
        });

        modelBuilder.Entity<RanchEquipmentItem>(entity =>
        {
            entity.ToTable("ranch_equipment_items");
            entity.HasIndex(x => x.ItemCode).IsUnique();
            entity.Property(x => x.ItemCode).HasMaxLength(32);
            entity.Property(x => x.ItemName).HasMaxLength(48);
            entity.Property(x => x.SlotCategory).HasMaxLength(16);
            entity.Property(x => x.WeightKg).HasPrecision(4, 2);
            entity.Property(x => x.SpeedBonus).HasPrecision(5, 2);
            entity.Property(x => x.StaminaBonus).HasPrecision(5, 2);
            entity.Property(x => x.BurstBonus).HasPrecision(5, 2);
            entity.Property(x => x.AgilityBonus).HasPrecision(5, 2);
            entity.Property(x => x.TurfModifier).HasPrecision(4, 2);
            entity.Property(x => x.DirtModifier).HasPrecision(4, 2);
            entity.Property(x => x.MuddyModifier).HasPrecision(4, 2);
            entity.Property(x => x.PriceCoin).HasPrecision(18, 2);
        });

        modelBuilder.Entity<RanchHorseEquipment>(entity =>
        {
            entity.ToTable("ranch_horse_equipment");
            entity.HasOne(x => x.EquipmentItem)
                .WithMany()
                .HasForeignKey(x => x.EquipmentItemId);
        });

        modelBuilder.Entity<RanchFeedLog>(entity =>
        {
            entity.ToTable("ranch_feed_logs");
            entity.HasIndex(x => x.IdempotencyKey).IsUnique();
            entity.Property(x => x.FeedCode).HasMaxLength(32);
            entity.Property(x => x.CoinCost).HasPrecision(18, 2);
            entity.Property(x => x.IdempotencyKey).HasMaxLength(128);
        });

        modelBuilder.Entity<RanchTrainingLog>(entity =>
        {
            entity.ToTable("ranch_training_logs");
            entity.HasIndex(x => x.IdempotencyKey).IsUnique();
            entity.Property(x => x.TrainingType).HasMaxLength(32);
            entity.Property(x => x.CoinCost).HasPrecision(18, 2);
            entity.Property(x => x.SpeedDelta).HasPrecision(5, 2);
            entity.Property(x => x.StaminaDelta).HasPrecision(5, 2);
            entity.Property(x => x.BurstDelta).HasPrecision(5, 2);
            entity.Property(x => x.AgilityDelta).HasPrecision(5, 2);
            entity.Property(x => x.TemperamentDelta).HasPrecision(5, 2);
            entity.Property(x => x.IdempotencyKey).HasMaxLength(128);
        });

        modelBuilder.Entity<RanchQualificationTrial>(entity =>
        {
            entity.ToTable("ranch_qualification_trials");
            entity.Property(x => x.TrialTimeSeconds).HasPrecision(6, 3);
            entity.Property(x => x.StandardBenchmark).HasPrecision(6, 3);
            entity.Property(x => x.FeeCharged).HasPrecision(18, 2);
        });

        modelBuilder.Entity<BackgroundJob>(entity =>
        {
            entity.ToTable("background_jobs");
            entity.HasIndex(x => x.IdempotencyKey).IsUnique();
            entity.Property(x => x.JobType).HasMaxLength(48);
            entity.Property(x => x.BusinessId).HasMaxLength(64);
            entity.Property(x => x.Status).HasMaxLength(16);
            entity.Property(x => x.IdempotencyKey).HasMaxLength(128);
        });

        modelBuilder.Entity<RaceEnvironment>(entity =>
        {
            entity.ToTable("race_environments");
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.EnvironmentType).HasMaxLength(16);
            entity.Property(x => x.Code).HasMaxLength(32);
            entity.Property(x => x.NameZh).HasMaxLength(48);
            entity.Property(x => x.NameEn).HasMaxLength(48);
            entity.Property(x => x.DescriptionZh).HasMaxLength(256);
            entity.Property(x => x.DescriptionEn).HasMaxLength(256);
            entity.Property(x => x.AdaptationBonusRate).HasPrecision(6, 4);
            entity.Property(x => x.VisualThemeKey).HasMaxLength(64);
        });

        modelBuilder.Entity<RaceCommentaryTemplate>(entity =>
        {
            entity.ToTable("race_commentary_templates");
            entity.Property(x => x.Phase).HasMaxLength(16);
            entity.Property(x => x.WeatherCondition).HasMaxLength(32);
            entity.Property(x => x.TextZh).HasMaxLength(256);
            entity.Property(x => x.TextEn).HasMaxLength(256);
            entity.Property(x => x.SoundCue).HasMaxLength(64);
        });

        modelBuilder.Entity<RaceTipsterTemplate>(entity =>
        {
            entity.ToTable("race_tipster_templates");
            entity.Property(x => x.MatchCondition).HasMaxLength(32);
            entity.Property(x => x.AnalysisZh).HasMaxLength(256);
            entity.Property(x => x.AnalysisEn).HasMaxLength(256);
        });

        modelBuilder.Entity<RanchFoalTier>(entity =>
        {
            entity.ToTable("ranch_foal_tiers");
            entity.HasIndex(x => x.TierCode).IsUnique();
            entity.Property(x => x.TierCode).HasMaxLength(24);
            entity.Property(x => x.TierNameZh).HasMaxLength(48);
            entity.Property(x => x.TierNameEn).HasMaxLength(48);
            entity.Property(x => x.AdoptPrice).HasPrecision(18, 2);
            entity.Property(x => x.MinPotential).HasPrecision(6, 2);
            entity.Property(x => x.MaxPotential).HasPrecision(6, 2);
            entity.Property(x => x.BaseSpeed).HasPrecision(6, 2);
            entity.Property(x => x.BaseStamina).HasPrecision(6, 2);
            entity.Property(x => x.BaseBurst).HasPrecision(6, 2);
            entity.Property(x => x.BaseAgility).HasPrecision(6, 2);
            entity.Property(x => x.BaseTemperament).HasPrecision(6, 2);
            entity.Property(x => x.DescriptionZh).HasMaxLength(256);
            entity.Property(x => x.DescriptionEn).HasMaxLength(256);
            entity.Property(x => x.RandomNamesJson).HasColumnType("jsonb");
        });

        modelBuilder.Entity<RanchFeedCatalog>(entity =>
        {
            entity.ToTable("ranch_feed_catalogs");
            entity.HasIndex(x => x.FeedCode).IsUnique();
            entity.Property(x => x.FeedCode).HasMaxLength(32);
            entity.Property(x => x.FeedNameZh).HasMaxLength(48);
            entity.Property(x => x.FeedNameEn).HasMaxLength(48);
            entity.Property(x => x.FeedCategory).HasMaxLength(16);
            entity.Property(x => x.CoinCost).HasPrecision(18, 2);
            entity.Property(x => x.BurstBonus).HasPrecision(5, 2);
            entity.Property(x => x.TemperamentBonus).HasPrecision(5, 2);
            entity.Property(x => x.DescriptionZh).HasMaxLength(256);
            entity.Property(x => x.DescriptionEn).HasMaxLength(256);
        });

        modelBuilder.Entity<RanchTrainingCatalog>(entity =>
        {
            entity.ToTable("ranch_training_catalogs");
            entity.HasIndex(x => x.TrainingType).IsUnique();
            entity.Property(x => x.TrainingType).HasMaxLength(32);
            entity.Property(x => x.TrainingNameZh).HasMaxLength(48);
            entity.Property(x => x.TrainingNameEn).HasMaxLength(48);
            entity.Property(x => x.CoinCost).HasPrecision(18, 2);
            entity.Property(x => x.SpeedDelta).HasPrecision(5, 2);
            entity.Property(x => x.StaminaDelta).HasPrecision(5, 2);
            entity.Property(x => x.BurstDelta).HasPrecision(5, 2);
            entity.Property(x => x.AgilityDelta).HasPrecision(5, 2);
            entity.Property(x => x.TemperamentDelta).HasPrecision(5, 2);
            entity.Property(x => x.DescriptionZh).HasMaxLength(256);
            entity.Property(x => x.DescriptionEn).HasMaxLength(256);
        });

        modelBuilder.Entity<RanchCareCatalog>(entity =>
        {
            entity.ToTable("ranch_care_catalogs");
            entity.HasIndex(x => x.CareType).IsUnique();
            entity.Property(x => x.CareType).HasMaxLength(32);
            entity.Property(x => x.CareNameZh).HasMaxLength(48);
            entity.Property(x => x.CareNameEn).HasMaxLength(48);
            entity.Property(x => x.CoinCost).HasPrecision(18, 2);
            entity.Property(x => x.DescriptionZh).HasMaxLength(256);
            entity.Property(x => x.DescriptionEn).HasMaxLength(256);
        });

        ApplySnakeCaseColumnNames(modelBuilder);
    }

    private static void ApplySnakeCaseColumnNames(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                property.SetColumnName(ToSnakeCase(property.Name));
            }
        }
    }

    private static string ToSnakeCase(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        var chars = new List<char>(value.Length + 8);

        for (var i = 0; i < value.Length; i++)
        {
            var current = value[i];
            var hasPrevious = i > 0;
            var hasNext = i + 1 < value.Length;

            if (char.IsUpper(current))
            {
                var previousIsLowerOrDigit = hasPrevious && (char.IsLower(value[i - 1]) || char.IsDigit(value[i - 1]));
                var nextIsLower = hasNext && char.IsLower(value[i + 1]);

                if (hasPrevious && (previousIsLowerOrDigit || nextIsLower))
                {
                    chars.Add('_');
                }

                chars.Add(char.ToLowerInvariant(current));
            }
            else if (char.IsDigit(current))
            {
                // PostgreSQL 迁移使用 rank_1_count 形式，连续数字只在首位前分词。
                if (hasPrevious && !char.IsDigit(value[i - 1]) && value[i - 1] != '_')
                {
                    chars.Add('_');
                }

                chars.Add(current);
            }
            else
            {
                chars.Add(current);
            }
        }

        return new string(chars.ToArray());
    }
}
