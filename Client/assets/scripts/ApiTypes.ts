/** API 通用响应信封。所有客户端网络结果都必须先经过该结构校验。 */
export interface ApiEnvelope<T> {
    code: number | string;
    message?: string;
    data: T;
    maintenance?: MaintenanceDto | null;
}

/** 服务器返回的六匹马轮次快照。 */
export interface RaceHorseDto {
    horseNo: number;
    horseTemplateId: number;
    horseNameZhSnapshot?: string;
    horseNameEnSnapshot?: string;
    avatarAssetSnapshot?: string;
    portraitAssetSnapshot?: string;
    odds: number;
    totalRacesSnapshot?: number;
    winRateSnapshot?: number;
    rank1ProbabilitySnapshot?: number;
    rank2ProbabilitySnapshot?: number;
    rank3ProbabilitySnapshot?: number;
    rank4ProbabilitySnapshot?: number;
    rank5ProbabilitySnapshot?: number;
    rank6ProbabilitySnapshot?: number;
    finalRank?: number | null;
    finishTime?: number | null;
    animation?: string | null;
    recentRanks?: number[];
    preferredTrack?: string;
    runningStyle?: string;
    preferredWeather?: string;
}

/** 连赢（Quinella）二连碰单项组合赔率项。 */
export interface QuinellaOddItem {
    combination: string;
    horse1: number;
    horse2: number;
    odds: number;
}

/** 维护配置通知 DTO。 */
export interface MaintenanceDto {
    isMaintenanceEnabled: boolean;
    isMaintenanceActive?: boolean;
    inNoticeWindow?: boolean;
    maintenanceStartAt?: string | null;
    maintenanceEndAt?: string | null;
    noticeMinutes?: number;
    remainingMinutes?: number | null;
    minutesUntilStart?: number | null;
    reason?: string | null;
    maintenanceReason?: string | null;
}

/** 当前比赛轮次 DTO。 */
export interface RaceRoundDto {
    id: number;
    roundNo: string;
    state: RaceState;
    weather?: string;
    trackType?: string;
    bettingStartAt: string;
    bettingEndAt: string;
    prepareStartAt?: string | null;
    raceStartAt?: string | null;
    raceEndAt?: string | null;
    settlementAt?: string | null;
    winnerHorseNo?: number | null;
    secondHorseNo?: number | null;
    quinellaCombination?: string | null;
    bettingDurationSeconds: number;
    prepareDurationSeconds: number;
    raceDurationSeconds: number;
    postRaceIntervalSeconds: number;
    horses: RaceHorseDto[];
    quinellaOdds?: QuinellaOddItem[];
    resultSeedCommitment?: string | null;
    resultSeed?: string | null;
    payoutPoolAmount?: number;
    dilutionFactor?: number;
    maintenance?: MaintenanceDto | null;
    isPhotoFinish?: boolean;
    photoFinishGapSeconds?: number | null;
    commentaryScriptJson?: string | null;
    jackpotDropped?: boolean;
    jackpotDropAmount?: number;
}

/** 解说单句条目 DTO。 */
export interface CommentaryItemDto {
    second: number;
    phase: string;
    textZh: string;
    textEn: string;
    soundCue?: string | null;
}

/** 赛前情报与早报推荐条目 DTO。 */
export interface TipsterRecommendationDto {
    horseNo: number;
    starRating: number;
    odds: number;
    preferredTrack: string;
    preferredWeather: string;
    analysisZh: string;
}

/** 赛前情报与全服大奖池数据 DTO。 */
export interface PaddockInfoDto {
    jackpotPoolAmount: number;
    jackpotPoolCode: string;
    weather: string;
    trackType: string;
    isCommentaryEnabled: boolean;
    isTipsterEnabled: boolean;
    inPlayWindowStartSecond: number;
    inPlayWindowDurationSeconds: number;
    inPlayBoostProfitRate: number;
    recommendations: TipsterRecommendationDto[];
}

/** 局内冲刺加倍追投请求 DTO。 */
export interface DoubleDownRequestDto {
    orderNo: string;
    idempotencyKey: string;
}

/** 局内冲刺加倍追投响应 DTO。 */
export interface DoubleDownResponseDto {
    orderNo: string;
    additionalDeducted: number;
    newTotalBet: number;
    currentBalance: number;
}

/** 比赛状态值与数据库 RaceState 保持一致，禁止重排。 */
export enum RaceState {
    Betting = 1,
    Closed = 2,
    Preparing = 3,
    Racing = 4,
    Settlement = 5,
    Finished = 6,
    Cancelled = 7,
}

/** 注单业务状态枚举。 */
export enum BetOrderStatus {
    Pending = 1,
    Won = 2,
    Lost = 3,
    Refunded = 4,
    Cancelled = 5,
}

/** 下注接口成功返回的数据。 */
export interface PlaceBetResponse {
    orderNo: string;
    playerId: number;
    roundId: number;
    horseNo: number;
    playType?: string;
    secondHorseNo?: number | null;
    thirdHorseNo?: number | null;
    combination?: string | null;
    betAmount: number;
    lockedOdds: number;
    grossReward: number;
    feeRate: number;
    feeAmount: number;
    netReward: number;
    dilutionFactor?: number;
    status?: number;
    balance: number;
    serverTime: string;
}

/** 当前玩家摘要。 */
export interface PlayerSummary {
    playerId: number;
    accountId: string;
    nickname: string;
    avatarAsset?: string;
    locale?: string;
    level: number;
    exp: number;
    balance: number;
    inviteCode?: string;
    referredBy?: number | null;
    totalRoundsParticipated: number;
    totalRoundsWon: number;
    winRate: number;
    totalNetProfitWins?: number;
    currentHitStreak?: number;
    maxHitStreak?: number;
    currentProfitStreak?: number;
    maxProfitStreak?: number;
    character?: {
        characterId: number;
        characterCode: string;
        nameZh: string;
        nameEn?: string;
        avatarAsset?: string;
        portraitAsset?: string;
        level: number;
        exp: number;
    } | null;
    relief?: {
        status: string;
        scheduledAt: string;
        grantAt: string;
        amount: number;
        businessDate: string;
        grantedTransactionId?: number | null;
        dailyCount?: number;
    } | null;
}

/** 功勋/成就 DTO（对应 1.png Feat 页面）。 */
export interface AchievementDto {
    id: number;
    playerAchievementId: number;
    achievementCode: string;
    category: string;
    titleZh: string;
    titleEn: string;
    descriptionZh: string;
    descriptionEn: string;
    iconAsset?: string | null;
    badgeName?: string | null;
    currentProgress: number;
    targetValue: number;
    isCompleted: boolean;
    completedAt?: string | null;
    isClaimed: boolean;
    claimedAt?: string | null;
    rewardType: string;
    rewardAmount: number;
}

/** 领奖响应 DTO。 */
export interface AchievementClaimResponse {
    playerAchievementId: number;
    achievementId: number;
    achievementCode: string;
    rewardType: string;
    rewardAmount: number;
    balance: number;
    serverTime: string;
}

/** 好友推荐概览 DTO。 */
export interface ReferralRewardItemDto {
    id: number;
    referrerPlayerId: number;
    invitedPlayerId: number;
    invitedNickname: string;
    rewardType: string;
    amount: number;
    status: string;
    createdAt: string;
}

export interface ReferralSummaryDto {
    inviteCode: string;
    referredByPlayerId?: number | null;
    invitedCount: number;
    totalRewardAmount: number;
    unclaimedCommissionAmount?: number;
    totalClaimedCommissionAmount?: number;
    commissionRateDescription?: string;
    recentRewards: ReferralRewardItemDto[];
}

export interface ClaimCommissionResponse {
    success: boolean;
    claimedAmount: number;
    newBalance: number;
    serverTime: string;
}

/** 角色列表项目。 */
export interface CharacterDto {
    characterId: number;
    characterCode: string;
    nameZh: string;
    nameEn?: string;
    descriptionZh?: string;
    descriptionEn?: string;
    avatarAsset?: string;
    portraitAsset?: string;
    metadata?: string;
    isDefault: boolean;
    isOwned: boolean;
    isEquipped: boolean;
    level: number;
    exp: number;
    levels: Array<{
        level: number;
        requiredExp: number;
        rewardType?: string;
        rewardPayload?: string;
    }>;
}

/** 公告项目。 */
export interface NoticeDto {
    noticeId: number;
    noticeCode: string;
    titleZh: string;
    titleEn?: string;
    contentZh: string;
    contentEn?: string;
    noticeType: string;
    version: number;
    isForced: boolean;
    isRead?: boolean;
    publishedAt?: string | null;
    startAt?: string | null;
    endAt?: string | null;
}

/** 服务端 SignalR 事件的完整公共结构（覆盖轮次切换、赛果揭示与维护通知）。 */
export interface RaceEventPayload {
    roundId?: number;
    roundNo?: string;
    state?: number;
    serverTime?: string;
    message?: string;
    reason?: string;
    maintenanceStartAt?: string | null;
    maintenanceEndAt?: string | null;
    winnerHorseNo?: number | null;
    secondHorseNo?: number | null;
    quinellaCombination?: string | null;
    bettingStartAt?: string;
    bettingEndAt?: string;
    prepareStartAt?: string | null;
    raceStartAt?: string | null;
    raceEndAt?: string | null;
    horses?: RaceHorseDto[];
    durationMs?: number;
    gapTime?: number;
    horse1?: number;
    horse2?: number;
    totalPool?: number;
    rainBonusPerUser?: number;
    remainingSeconds?: number;
    readyCount?: number;
    totalBettors?: number;
}

/** 模式三：西部纯血马房专属赛马 DTO */
export interface RanchHorseDto {
    id: number;
    ownerPlayerId: number;
    horseCode: string;
    customName: string;
    gender: "STALLION" | "MARE";
    growthStage: "FOAL" | "JUVENILE" | "MATURE" | "PRO_RACER";
    level: number;
    currentExp: number;
    maxExp: number;
    pedigreeTier: "WILD" | "PLAINS_TB" | "ROYAL" | "MYTHIC";
    generation: number;
    coatColor: string;
    runningStyle: string;
    speedStat: number;
    speedPotential: number;
    staminaStat: number;
    staminaPotential: number;
    burstStat: number;
    burstPotential: number;
    agilityStat: number;
    agilityPotential: number;
    temperamentStat: number;
    temperamentPotential: number;
    hungerLevel: number;
    staminaEnergy: number;
    conditionLevel: number;
    hoofWear: number;
    intimacyLevel: number;
    healthPoints: number;
    saddleItemId?: number | null;
    stirrupItemId?: number | null;
    horseshoeItemId?: number | null;
    isLicensedRacer: boolean;
    qualificationTime?: number | null;
    licenseCertCode?: string | null;
    totalCareerRaces: number;
    totalCareerWins: number;
    accumulatedPurse: number;
    subStatus: string;
    createdAt: string;
}

export interface RanchEquipmentDto {
    id: number;
    itemCode: string;
    itemName: string;
    slotCategory: "SADDLE" | "STIRRUP" | "HORSESHOE";
    speedBonus: number;
    staminaBonus: number;
    burstBonus: number;
    agilityBonus: number;
    maxDurability: number;
    priceCoin: number;
}

export interface PlayerEquipmentDto {
    id: number;
    equipmentItemId: number;
    itemCode: string;
    itemName: string;
    slotCategory: "SADDLE" | "STIRRUP" | "HORSESHOE";
    equippedHorseId?: number | null;
    currentDurability: number;
    isEquipped: boolean;
}

export interface FeedResultDto {
    success: boolean;
    colicTriggered: boolean;
    newLevel: number;
    newExp: number;
    newHunger: number;
    newCondition: number;
    growthStage: string;
    newBalance: number;
}

export interface TrainResultDto {
    success: boolean;
    trainingType: string;
    speedDelta: number;
    staminaDelta: number;
    burstDelta: number;
    agilityDelta: number;
    temperamentDelta: number;
    newStaminaEnergy: number;
    newHoofWear: number;
    newCondition: number;
    newLevel: number;
    newExp: number;
    newBalance: number;
}

export interface CareResultDto {
    success: boolean;
    careType: string;
    newCondition: number;
    newStaminaEnergy: number;
    newIntimacy: number;
    newHealthPoints: number;
    subStatus: string;
    newBalance: number;
}

export interface TrialResultDto {
    isPassed: boolean;
    trialTime: number;
    standardBenchmark: number;
    feeCharged: number;
    licenseCertCode?: string | null;
    growthStage: string;
    newBalance: number;
}

export interface BuybackResultDto {
    horseId: number;
    payoutAmount: number;
    newBalance: number;
}

export interface RepairEquipmentResultDto {
    playerEquipmentId: number;
    repairCost: number;
    newDurability: number;
    newBalance: number;
}

export type RanchHorseSummaryDto = RanchHorseDto;
export type RanchHorseDetailDto = RanchHorseDto;
export type RanchQualificationTrialDto = TrialResultDto;

export interface FoalTierCatalogDto {
    tierCode: string;
    tierNameZh: string;
    tierNameEn: string;
    adoptPrice: number;
    minPotential: number;
    maxPotential: number;
    baseSpeed: number;
    baseStamina: number;
    baseBurst: number;
    baseAgility: number;
    baseTemperament: number;
    descriptionZh: string;
    descriptionEn: string;
    randomNames: string[];
}

export interface FeedCatalogDto {
    feedCode: string;
    feedNameZh: string;
    feedNameEn: string;
    feedCategory: string;
    coinCost: number;
    hungerFill: number;
    expGain: number;
    conditionBonus: number;
    burstBonus: number;
    temperamentBonus: number;
    descriptionZh: string;
    descriptionEn: string;
}

export interface TrainingCatalogDto {
    trainingType: string;
    trainingNameZh: string;
    trainingNameEn: string;
    coinCost: number;
    energyCost: number;
    expGain: number;
    hoofWearDelta: number;
    conditionLoss: number;
    speedDelta: number;
    staminaDelta: number;
    burstDelta: number;
    agilityDelta: number;
    temperamentDelta: number;
    descriptionZh: string;
    descriptionEn: string;
}

export interface CareCatalogDto {
    careType: string;
    careNameZh: string;
    careNameEn: string;
    coinCost: number;
    cooldownHours: number;
    intimacyBonus: number;
    conditionBonus: number;
    healthBonus: number;
    energyBonus: number;
    hoofWearRelief: number;
    clearsIllness: boolean;
    clearsInjury: boolean;
    descriptionZh: string;
    descriptionEn: string;
}

export interface RanchCatalogDto {
    foalTiers: FoalTierCatalogDto[];
    feeds: FeedCatalogDto[];
    trainings: TrainingCatalogDto[];
    cares: CareCatalogDto[];
    qualificationBenchmark: number;
    qualificationBaseTime: number;
    qualificationLicenseFee: number;
}

export interface RaceEnvironmentDto {
    id: number;
    environmentType: "WEATHER" | "TRACK";
    code: string;
    nameZh: string;
    nameEn: string;
    adaptationBonusRate: number;
    selectionWeight: number;
    visualThemeKey?: string;
}

export interface RaceConfigDto {
    rules: any;
    environments: RaceEnvironmentDto[];
}
