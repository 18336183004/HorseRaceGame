/**
 * 《西部边境赛马会》独立西部风格声音合成与混音引擎。
 * 遵循 racegame-project-standards，严禁 any。
 * 纯 Web Audio API 算法合成，零外部 mp3 资源依赖。
 *
 * 架构特点：
 * 1. 四层立体混音母带总线：Master -> (BGM / Ambience / SFX / UI) -> Peak Limiter -> Destination；
 * 2. 8 景八曲专属 BGM，切换时提供 1.2 秒平滑交叉淡化 (crossFade)；
 * 3. 15+ 拟真美式西部音效（左轮撞针、火漆沉击、马刺叮当、筹码碰撞、马蹄疾驰、发令枪响、金币瀑布等）；
 * 4. 完整的音量控制、静音记忆与切页防爆音/防串音机制。
 */
import { WestPerformance } from "./WestPerformance";

/** 玩法模式与音频分路 */
export type AudioPlayMode = "WIN" | "QUINELLA" | "COMMON";

export class WestAudio {
    private static ctx: AudioContext | null = null;
    private static compressor: DynamicsCompressorNode | null = null;
    private static masterGain: GainNode | null = null;
    private static bgmGain: GainNode | null = null;
    private static ambienceGain: GainNode | null = null;
    private static sfxGain: GainNode | null = null;
    private static uiGain: GainNode | null = null;

    // 双模式专属总线拓扑
    private static winSfxGain: GainNode | null = null;
    private static quinellaSfxGain: GainNode | null = null;

    // 当前激活模式与切换调度状态
    private static activeMode: "WIN" | "QUINELLA" = "WIN";
    private static previousMode: "WIN" | "QUINELLA" = "WIN";

    // 模式发声状态记录
    private static modePlaying: Record<"WIN" | "QUINELLA", boolean> = {
        WIN: false,
        QUINELLA: false,
    };
    // 切换后模式是否正在等待“下一个全新音效”出来才开始播放
    private static modeWaitingForNextSound: Record<"WIN" | "QUINELLA", boolean> = {
        WIN: false,
        QUINELLA: false,
    };
    // 各模式正在发声的节点句柄集合
    private static activeModeNodes: Record<"WIN" | "QUINELLA", AudioNode[]> = {
        WIN: [],
        QUINELLA: [],
    };
    // 当前正在讲台词的 Cowboy 语音模式
    private static currentSpeakingMode: "WIN" | "QUINELLA" | null = null;
    private static currentSpeakingTimer: ReturnType<typeof setTimeout> | null = null;


    private static soundEnabled = true;
    private static musicEnabled = true;
    private static masterVolume = 1.0;
    private static bgmVolume = 0.65;
    private static sfxVolume = 0.85;

    // 当前 BGM 状态
    private static currentBgmPage: string | null = null;
    private static bgmTimer: ReturnType<typeof setInterval> | null = null;
    private static bgmFadeTimeout: ReturnType<typeof setTimeout> | null = null;
    private static activeBgmNodes: OscillatorNode[] = [];

    // 环境音状态 (v2.1 单层底噪 + 4场景滤波调制)
    private static ambienceTimer: ReturnType<typeof setInterval> | null = null;
    private static currentAmbienceScene: "lobby" | "arena" | "stables" | "wild" | null = null;
    private static activeAmbienceNodes: (AudioNode | OscillatorNode | AudioScheduledSourceNode)[] = [];
    private static activeVoiceCount = 0;

    // 赛马疾驰循环
    private static gallopTimer: ReturnType<typeof setInterval> | null = null;
    private static isGalloping = false;

    /** 初始化或恢复 Web Audio 上下文与总线拓扑 */
    private static getContext(): AudioContext | null {
        if (typeof window === "undefined") {
            return null;
        }

        if (!this.ctx) {
            const AudioCtx =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (!AudioCtx) {
                return null;
            }

            this.ctx = new AudioCtx();

            // 构建防爆音母带压限器 (Peak Limiter)
            this.compressor = this.ctx.createDynamicsCompressor();
            this.compressor.threshold.setValueAtTime(-3, this.ctx.currentTime);
            this.compressor.knee.setValueAtTime(4, this.ctx.currentTime);
            this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
            this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
            this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);
            this.compressor.connect(this.ctx.destination);

            // 母带增益：任一音频流启用时开放总线，细分静音由分路 Gain 独立掌控
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime((this.soundEnabled || this.musicEnabled) ? this.masterVolume : 0, this.ctx.currentTime);
            this.masterGain.connect(this.compressor);

            // BGM 分路
            this.bgmGain = this.ctx.createGain();
            this.bgmGain.gain.setValueAtTime(this.musicEnabled ? this.bgmVolume : 0, this.ctx.currentTime);
            this.bgmGain.connect(this.masterGain);

            // 环境音分路
            this.ambienceGain = this.ctx.createGain();
            this.ambienceGain.gain.setValueAtTime(this.musicEnabled ? this.bgmVolume * 0.5 : 0, this.ctx.currentTime);
            this.ambienceGain.connect(this.masterGain);

            // SFX 分路
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.setValueAtTime(this.soundEnabled ? this.sfxVolume : 0, this.ctx.currentTime);
            this.sfxGain.connect(this.masterGain);

            // WIN 专属 SFX 分路
            this.winSfxGain = this.ctx.createGain();
            this.winSfxGain.gain.setValueAtTime(this.activeMode === "WIN" ? 1.0 : 0.0, this.ctx.currentTime);
            this.winSfxGain.connect(this.sfxGain);

            // QUINELLA 专属 SFX 分路
            this.quinellaSfxGain = this.ctx.createGain();
            this.quinellaSfxGain.gain.setValueAtTime(this.activeMode === "QUINELLA" ? 1.0 : 0.0, this.ctx.currentTime);
            this.quinellaSfxGain.connect(this.sfxGain);

            // UI 分路
            this.uiGain = this.ctx.createGain();
            this.uiGain.gain.setValueAtTime(this.soundEnabled ? this.sfxVolume * 0.9 : 0, this.ctx.currentTime);
            this.uiGain.connect(this.masterGain);

            // 恢复本地存储偏好
            this.restorePreferences();
        }

        if (this.ctx.state === "suspended") {
            void this.ctx.resume();
        }

        return this.ctx;
    }

    /** 从本地存储恢复玩家音量偏好（双 Key 兼容） */
    public static restorePreferences(): void {
        if (typeof localStorage === "undefined") return;
        const sound = localStorage.getItem("racegame.soundEnabled") ?? localStorage.getItem("racegame_audio_sfx");
        if (sound !== null) this.soundEnabled = sound === "true";
        const music = localStorage.getItem("racegame.musicEnabled") ?? localStorage.getItem("racegame_audio_music");
        if (music !== null) this.musicEnabled = music === "true";
        const bgmVol = localStorage.getItem("racegame.bgmVolume");
        if (bgmVol !== null) this.bgmVolume = parseFloat(bgmVol) || 0.65;
        const sfxVol = localStorage.getItem("racegame.sfxVolume");
        if (sfxVol !== null) this.sfxVolume = parseFloat(sfxVol) || 0.85;

        this.applyGains();
    }

    private static applyGains(): void {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime((this.soundEnabled || this.musicEnabled) ? this.masterVolume : 0, now);
        }
        if (this.bgmGain) {
            this.bgmGain.gain.setValueAtTime(this.musicEnabled ? this.bgmVolume : 0, now);
        }
        if (this.ambienceGain) {
            this.ambienceGain.gain.setValueAtTime(this.musicEnabled ? this.bgmVolume * 0.5 : 0, now);
        }
        if (this.sfxGain) {
            this.sfxGain.gain.setValueAtTime(this.soundEnabled ? this.sfxVolume : 0, now);
        }
        if (this.winSfxGain) {
            const winVal = (this.activeMode === "WIN" && !this.modeWaitingForNextSound.WIN) ? 1.0 : (this.previousMode === "WIN" && this.modePlaying.WIN ? 1.0 : 0.0);
            this.winSfxGain.gain.setValueAtTime(winVal, now);
        }
        if (this.quinellaSfxGain) {
            const qVal = (this.activeMode === "QUINELLA" && !this.modeWaitingForNextSound.QUINELLA) ? 1.0 : (this.previousMode === "QUINELLA" && this.modePlaying.QUINELLA ? 1.0 : 0.0);
            this.quinellaSfxGain.gain.setValueAtTime(qVal, now);
        }
        if (this.uiGain) {
            this.uiGain.gain.setValueAtTime(this.soundEnabled ? this.sfxVolume * 0.9 : 0, now);
        }
    }

    public static setSoundEnabled(enabled: boolean): void {
        this.soundEnabled = enabled;
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("racegame.soundEnabled", String(enabled));
            localStorage.setItem("racegame_audio_sfx", String(enabled));
        }
        if (!enabled) {
            this.stopGallopLoop();
        }
        this.applyGains();
    }

    public static setMusicEnabled(enabled: boolean): void {
        this.musicEnabled = enabled;
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("racegame.musicEnabled", String(enabled));
            localStorage.setItem("racegame_audio_music", String(enabled));
        }
        if (!enabled) {
            this.stopBgm();
        } else if (this.currentBgmPage) {
            this.switchPageBgm(this.currentBgmPage);
        }
        this.applyGains();
    }

    public static setBgmVolume(vol: number): void {
        this.bgmVolume = Math.max(0, Math.min(1, vol));
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("racegame.bgmVolume", String(this.bgmVolume));
        }
        this.applyGains();
    }

    public static setSfxVolume(vol: number): void {
        this.sfxVolume = Math.max(0, Math.min(1, vol));
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("racegame.sfxVolume", String(this.sfxVolume));
        }
        this.applyGains();
    }

    public static isSoundEnabled(): boolean {
        return this.soundEnabled;
    }

    public static isMusicEnabled(): boolean {
        return this.musicEnabled;
    }

    public static getBgmVolume(): number {
        return this.bgmVolume;
    }

    public static getSfxVolume(): number {
        return this.sfxVolume;
    }

    public static getActiveMode(): "WIN" | "QUINELLA" {
        return this.activeMode;
    }

    public static getPreviousMode(): "WIN" | "QUINELLA" {
        return this.previousMode;
    }

    /**
     * 玩家在切换模式的时候：
     * 1. 优先播放切换前模式的声音：若切换前模式正在发声，允许其自然播放完毕（不掐断原模式当前发声）；
     * 2. 如果这个时候切换后的模式正在播放，那么就先停止：立即掐断切换后模式的遗留节点与旧语音；
     * 3. 等到下一个音效出来再进行播放：将切换后模式置为 waitingForNextSound 状态；
     * 4. 两种模式的声音完全总线隔离，绝不搞混。
     */
    public static switchMode(targetMode: "WIN" | "QUINELLA"): void {
        if (this.activeMode === targetMode) {
            return;
        }

        const prevMode = this.activeMode;
        this.previousMode = prevMode;
        this.activeMode = targetMode;

        const ctx = this.getContext();
        const now = ctx ? ctx.currentTime : 0;

        // 1. 如果这个时候切换后的模式正在播放，那么就先停止！
        if (this.modePlaying[targetMode] || this.activeModeNodes[targetMode].length > 0 || this.currentSpeakingMode === targetMode) {
            this.stopModeAudio(targetMode);
        }

        // 2. 切换后的模式进入等待“下一个音效”出来的状态
        this.modeWaitingForNextSound[targetMode] = true;

        // 3. 总线调度：
        // 目标模式先静音（等下一个音效触发时再开启增益）
        const targetGain = targetMode === "WIN" ? this.winSfxGain : this.quinellaSfxGain;
        if (targetGain && ctx) {
            targetGain.gain.cancelScheduledValues(now);
            targetGain.gain.setValueAtTime(0.0, now);
        }

        // 优先播放切换前模式的声音：
        // 若切换前模式正在发音，保持原模式增益不立即强制归零，待其当前音效自然结束；
        // 若切换前模式没有在发音，则可直接将原模式增益置为 0
        const prevGain = prevMode === "WIN" ? this.winSfxGain : this.quinellaSfxGain;
        if (prevGain && ctx) {
            if (!this.modePlaying[prevMode] && this.currentSpeakingMode !== prevMode) {
                prevGain.gain.cancelScheduledValues(now);
                prevGain.gain.setValueAtTime(0.0, now);
            }
            // 若正在发音，保持 prevGain 开启，让声音自然落幕
        }

        // 4. BGM 模式联动：如果在赛场中，平滑淡入切换后模式的专属 BGM
        if (this.currentBgmPage && (this.currentBgmPage === "race" || this.currentBgmPage.startsWith("race_"))) {
            this.switchPageBgm(targetMode === "QUINELLA" ? "race_quinella" : "race_win");
        }
    }

    /** 立即停止指定模式的所有正在发声的节点与语音 */
    public static stopModeAudio(mode: "WIN" | "QUINELLA"): void {
        const nodes = this.activeModeNodes[mode];
        for (const node of nodes) {
            try {
                if ("stop" in node && typeof (node as AudioScheduledSourceNode).stop === "function") {
                    (node as AudioScheduledSourceNode).stop();
                }
                node.disconnect();
            } catch {
                // ignore
            }
        }
        this.activeModeNodes[mode] = [];
        this.modePlaying[mode] = false;

        if (this.currentSpeakingMode === mode) {
            if (typeof window !== "undefined" && "speechSynthesis" in window) {
                try {
                    window.speechSynthesis.cancel();
                } catch {
                    // ignore
                }
            }
            this.currentSpeakingMode = null;
            if (this.currentSpeakingTimer !== null) {
                clearTimeout(this.currentSpeakingTimer);
                this.currentSpeakingTimer = null;
            }
        }

        if (this.ctx) {
            const gainNode = mode === "WIN" ? this.winSfxGain : this.quinellaSfxGain;
            if (gainNode) {
                gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
                gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
            }
        }
    }

    /** 获取指定模式专属的混音输出增益节点 */
    private static getTargetGain(mode: AudioPlayMode = "COMMON", preferUi = false): GainNode | null {
        if (!this.ctx) return null;
        if (mode === "WIN") {
            return this.winSfxGain ?? this.sfxGain;
        }
        if (mode === "QUINELLA") {
            return this.quinellaSfxGain ?? this.sfxGain;
        }
        return preferUi ? (this.uiGain ?? this.sfxGain) : (this.sfxGain ?? this.masterGain);
    }

    /**
     * 判断并登记某模式音效是否允许发声：
     * 1. COMMON 公共音效始终允许；
     * 2. 非当前激活模式且非公共音效一律拦截（玩家在哪个页面播放对应页面的声音）；
     * 3. 处于切模式后“等待下一个全新音效”状态时，当前触发的第一个音效即为“下一个音效”，
     *    立即唤醒该模式通道并正式发声！
     */
    private static registerModeSound(mode: AudioPlayMode = "COMMON", durationSec = 0.2): boolean {
        if (!this.soundEnabled) return false;
        // P6 性能预算：复音数上限拦截 (低端设备与省电模式削减)
        if (this.activeVoiceCount >= WestPerformance.getPolyphonyLimit()) {
            return false;
        }
        if (mode === "COMMON") return true;

        // 如果不是当前激活的模式，禁止发声（杜绝串音与搞混）
        if (mode !== this.activeMode) {
            return false;
        }

        const ctx = this.getContext();
        const now = ctx ? ctx.currentTime : 0;

        // 若当前模式正处于“切换后等待下一个音效”的状态：
        // 这意味着“下一个音效”终于出来了！恢复正常播放！
        if (this.modeWaitingForNextSound[mode]) {
            this.modeWaitingForNextSound[mode] = false;
            const gainNode = mode === "WIN" ? this.winSfxGain : this.quinellaSfxGain;
            if (gainNode && ctx) {
                gainNode.gain.cancelScheduledValues(now);
                gainNode.gain.setValueAtTime(1.0, now);
            }
            // 确保另一模式静音
            const otherMode = mode === "WIN" ? "QUINELLA" : "WIN";
            const otherGain = otherMode === "WIN" ? this.winSfxGain : this.quinellaSfxGain;
            if (otherGain && ctx) {
                otherGain.gain.cancelScheduledValues(now);
                otherGain.gain.setValueAtTime(0.0, now);
            }
            if (this.currentSpeakingMode === otherMode) {
                if (typeof window !== "undefined" && "speechSynthesis" in window) {
                    try {
                        window.speechSynthesis.cancel();
                    } catch {
                        // ignore
                    }
                }
                this.currentSpeakingMode = null;
                if (this.currentSpeakingTimer !== null) {
                    clearTimeout(this.currentSpeakingTimer);
                    this.currentSpeakingTimer = null;
                }
            }
        }

        this.modePlaying[mode] = true;
        setTimeout(() => {
            if (this.activeModeNodes[mode].length === 0 && this.currentSpeakingMode !== mode) {
                this.modePlaying[mode] = false;
                if (this.activeMode !== mode && this.ctx) {
                    const gainNode = mode === "WIN" ? this.winSfxGain : this.quinellaSfxGain;
                    if (gainNode) {
                        gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
                        gainNode.gain.setValueAtTime(0.0, this.ctx.currentTime);
                    }
                }
            }
        }, Math.max(100, Math.round(durationSec * 1000)));

        return true;
    }

    /** 登记正在发声的节点，并在发声完毕后自动清理，杜绝内存泄漏；切模式时若需立即停止可精确定位 */
    private static trackNode(mode: AudioPlayMode, node: AudioNode): void {
        this.activeVoiceCount++;
        if (mode === "WIN" || mode === "QUINELLA") {
            this.activeModeNodes[mode].push(node);
            if (this.activeModeNodes[mode].length > 32) {
                this.activeModeNodes[mode].shift();
            }
        }
        if ("onended" in node) {
            const source = node as AudioScheduledSourceNode;
            const prevEnded = source.onended;
            source.onended = (ev: Event) => {
                this.activeVoiceCount = Math.max(0, this.activeVoiceCount - 1);
                if (mode === "WIN" || mode === "QUINELLA") {
                    const idx = this.activeModeNodes[mode].indexOf(node);
                    if (idx !== -1) {
                        this.activeModeNodes[mode].splice(idx, 1);
                    }
                    if (this.activeModeNodes[mode].length === 0 && this.currentSpeakingMode !== mode) {
                        this.modePlaying[mode] = false;
                        if (this.activeMode !== mode && this.ctx) {
                            const gainNode = mode === "WIN" ? this.winSfxGain : this.quinellaSfxGain;
                            if (gainNode) {
                                gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
                                gainNode.gain.setValueAtTime(0.0, this.ctx.currentTime);
                            }
                        }
                    }
                }
                if (typeof prevEnded === "function") {
                    prevEnded.call(source, ev);
                }
            };
        }
    }


    // =========================================================================
    // 1. Master Theme 主旋律动机 + 3 变奏与环境音床引擎 (v2.1 架构压缩至 1+3+1)
    // =========================================================================

    /**
     * 依据当前页面无缝淡入专属西部主题动机变奏与环境音
     * @param page 页面标签 (login, lobby, race, settlement, feats, stable, settings, history 等)
     */
    public static switchPageBgm(page: string): void {
        if (!this.musicEnabled) {
            this.currentBgmPage = page;
            this.stopAmbience();
            return;
        }

        if (this.currentBgmPage === page && this.bgmTimer !== null) {
            return;
        }

        const ctx = this.getContext();
        if (!ctx || !this.bgmGain) return;

        // 清理上一次未完成的淡入淡出定时器
        if (this.bgmFadeTimeout !== null) {
            clearTimeout(this.bgmFadeTimeout);
            this.bgmFadeTimeout = null;
        }

        // 1.2s 交叉淡化
        const now = ctx.currentTime;
        this.bgmGain.gain.cancelScheduledValues(now);
        this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, now);
        this.bgmGain.gain.linearRampToValueAtTime(0.001, now + 0.6);

        this.bgmFadeTimeout = setTimeout(() => {
            this.bgmFadeTimeout = null;
            this.stopBgm();
            this.currentBgmPage = page;
            if (!this.musicEnabled) return;

            this.startPageBgmSequence(page);

            // 依据页面调度环境音微环境 (大厅 / 竞技场 / 马厩 / 旷野)
            let ambScene: "lobby" | "arena" | "stables" | "wild" = "wild";
            if (page === "lobby") {
                ambScene = "lobby";
            } else if (["race", "race_win", "race_quinella"].includes(page)) {
                ambScene = "arena";
            } else if (["stable", "characters"].includes(page)) {
                ambScene = "stables";
            }
            this.switchAmbience(ambScene);

            if (this.ctx && this.bgmGain) {
                const startNow = this.ctx.currentTime;
                this.bgmGain.gain.cancelScheduledValues(startNow);
                this.bgmGain.gain.setValueAtTime(0.001, startNow);
                this.bgmGain.gain.linearRampToValueAtTime(this.bgmVolume, startNow + 0.6);
            }
        }, 600);
    }

    public static stopBgm(): void {
        if (this.bgmFadeTimeout !== null) {
            clearTimeout(this.bgmFadeTimeout);
            this.bgmFadeTimeout = null;
        }
        if (this.bgmTimer !== null) {
            clearInterval(this.bgmTimer);
            this.bgmTimer = null;
        }
        for (const osc of this.activeBgmNodes) {
            try {
                osc.stop();
                osc.disconnect();
            } catch {
                // ignore
            }
        }
        this.activeBgmNodes = [];
        this.stopAmbience();
    }

    /**
     * Master Theme (主旋律动机 1 首) + 3 变奏：
     * 统一和弦走向：Dm -> Bb -> F -> C
     * - 变奏 A：慢板口琴 (76 BPM) -> 登录 / 成就 / 马厩 (静谧空旷)
     * - 变奏 B：中板班卓 (112 BPM) -> 大厅 / 设置 / 历史 (日常沙龙)
     * - 变奏 C：快板弦乐 (148 BPM) -> 竞技场 / 结算 (高潮狂奔)
     */
    private static startPageBgmSequence(page: string): void {
        const ctx = this.getContext();
        if (!ctx || !this.bgmGain) return;

        // 核心西部主旋律和弦走向：Dm -> Bb -> F -> C
        const chordProgression: number[][] = [
            [147, 220, 294, 349], // Dm (D3, A3, D4, F4)
            [117, 175, 233, 294], // Bb (Bb2, F3, Bb3, D4)
            [175, 220, 262, 349], // F  (F3, A3, C4, F4)
            [131, 196, 262, 330], // C  (C3, G3, C4, E4)
        ];

        let variation: "A" | "B" | "C" = "B";
        if (["login", "register", "feats", "feat", "tasks", "ranking", "stable", "characters"].includes(page)) {
            variation = "A";
        } else if (["race", "race_win", "race_quinella", "result", "settlement"].includes(page)) {
            variation = "C";
        } else {
            variation = "B";
        }

        let tempo = 112;
        let waveType: OscillatorType = "triangle";
        let attackSec = 0.03;
        let noteLengthRatio = 0.75;
        let baseVolume = 0.06;

        switch (variation) {
            case "A": // 慢板口琴
                tempo = 76;
                waveType = "sine";
                attackSec = 0.08;
                noteLengthRatio = 0.95;
                baseVolume = 0.055;
                break;
            case "B": // 中板班卓
                tempo = 112;
                waveType = "sawtooth";
                attackSec = 0.02;
                noteLengthRatio = 0.65;
                baseVolume = 0.05;
                break;
            case "C": // 快板弦乐
                tempo = 148;
                waveType = page === "race_quinella" ? "square" : "sawtooth";
                attackSec = 0.015;
                noteLengthRatio = 0.55;
                baseVolume = 0.07;
                break;
        }

        let step = 0;
        const intervalMs = Math.round((60 / tempo) * 1000);

        this.bgmTimer = setInterval(() => {
            const currentCtx = this.getContext();
            if (!currentCtx || !this.bgmGain || !this.musicEnabled) return;

            try {
                const now = currentCtx.currentTime;
                const chord = chordProgression[step % chordProgression.length];
                const isDownBeat = step % 4 === 0;

                for (let i = 0; i < chord.length; i++) {
                    const osc = currentCtx.createOscillator();
                    const noteGain = currentCtx.createGain();

                    osc.type = i === 0 ? "triangle" : waveType;
                    const freq = chord[i];
                    const noteDelay = variation === "B" ? i * 0.035 : i * 0.045;
                    osc.frequency.setValueAtTime(freq, now + noteDelay);

                    if (variation === "A" && i > 0) {
                        osc.frequency.linearRampToValueAtTime(freq * 1.012, now + noteDelay + 0.35);
                        osc.frequency.linearRampToValueAtTime(freq, now + noteDelay + 0.7);
                    }

                    const vol = (isDownBeat ? baseVolume * 1.3 : baseVolume) * (1 / (i + 1));
                    noteGain.gain.setValueAtTime(0.0001, now + noteDelay);
                    noteGain.gain.linearRampToValueAtTime(vol, now + noteDelay + attackSec);
                    noteGain.gain.exponentialRampToValueAtTime(
                        0.0001,
                        now + noteDelay + (intervalMs / 1000) * noteLengthRatio,
                    );

                    osc.connect(noteGain);
                    noteGain.connect(this.bgmGain);

                    osc.start(now + noteDelay);
                    osc.stop(now + noteDelay + (intervalMs / 1000) * noteLengthRatio + 0.05);

                    this.activeBgmNodes.push(osc);
                    if (this.activeBgmNodes.length > 24) {
                        this.activeBgmNodes.shift();
                    }
                }

                step++;
            } catch {
                // ignore
            }
        }, intervalMs);
    }

    /**
     * Ambience (环境音床 1 层循环)
     * 通过混音比例与声学滤波参数模拟 4 种微环境：
     * - 大厅：室内混响 + 人群碎语
     * - 竞技场：高频尘土噪声 + 观众呐喊
     * - 马厩：低频动物呼吸
     * - 旷野：开阔沙地微风
     */
    public static switchAmbience(scene: "lobby" | "arena" | "stables" | "wild"): void {
        if (!this.musicEnabled) {
            this.stopAmbience();
            this.currentAmbienceScene = scene;
            return;
        }

        if (this.currentAmbienceScene === scene && this.ambienceTimer !== null) {
            return;
        }

        this.stopAmbience();
        this.currentAmbienceScene = scene;

        const layers = WestPerformance.getAmbienceLayers();
        if (layers <= 0) {
            return; // 省电模式
        }

        const ctx = this.getContext();
        if (!ctx || !this.ambienceGain) return;

        try {
            // 生成粉红/风噪底层循环 Buffer (2秒循环)
            const bufferSize = ctx.sampleRate * 2;
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            let b0 = 0, b1 = 0, b2 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99 * b0 + white * 0.05;
                b1 = 0.96 * b1 + white * 0.11;
                b2 = 0.86 * b2 + white * 0.25;
                output[i] = (b0 + b1 + b2) * 0.18;
            }

            const noiseSource = ctx.createBufferSource();
            noiseSource.buffer = noiseBuffer;
            noiseSource.loop = true;

            const filter = ctx.createBiquadFilter();
            switch (scene) {
                case "lobby":
                    filter.type = "lowpass";
                    filter.frequency.setValueAtTime(650, ctx.currentTime);
                    filter.Q.setValueAtTime(1.5, ctx.currentTime);
                    break;
                case "arena":
                    filter.type = "bandpass";
                    filter.frequency.setValueAtTime(1400, ctx.currentTime);
                    filter.Q.setValueAtTime(0.9, ctx.currentTime);
                    break;
                case "stables":
                    filter.type = "lowpass";
                    filter.frequency.setValueAtTime(380, ctx.currentTime);
                    filter.Q.setValueAtTime(1.0, ctx.currentTime);
                    break;
                case "wild":
                default:
                    filter.type = "bandpass";
                    filter.frequency.setValueAtTime(800, ctx.currentTime);
                    filter.Q.setValueAtTime(0.6, ctx.currentTime);
                    break;
            }

            const envGain = ctx.createGain();
            const now = ctx.currentTime;
            envGain.gain.setValueAtTime(0.001, now);
            envGain.gain.linearRampToValueAtTime(0.07, now + 0.8);

            noiseSource.connect(filter);
            filter.connect(envGain);
            envGain.connect(this.ambienceGain);

            noiseSource.start(now);
            this.activeAmbienceNodes.push(noiseSource, filter, envGain);

            // 第二层/第三层微环境调制
            if (layers >= 2) {
                this.ambienceTimer = setInterval(() => {
                    const cCtx = this.getContext();
                    if (!cCtx || !this.ambienceGain || !this.musicEnabled) return;
                    try {
                        const tNow = cCtx.currentTime;
                        if (scene === "stables") {
                            // 马厩动物周期呼吸起伏
                            const osc = cCtx.createOscillator();
                            const g = cCtx.createGain();
                            osc.type = "sine";
                            osc.frequency.setValueAtTime(95, tNow);
                            osc.frequency.linearRampToValueAtTime(80, tNow + 1.2);
                            g.gain.setValueAtTime(0.001, tNow);
                            g.gain.linearRampToValueAtTime(0.02, tNow + 0.6);
                            g.gain.exponentialRampToValueAtTime(0.0001, tNow + 1.4);
                            osc.connect(g);
                            g.connect(this.ambienceGain);
                            osc.start(tNow);
                            osc.stop(tNow + 1.5);
                        } else if (scene === "lobby" && layers >= 3) {
                            // 沙龙酒杯碰击与窃语
                            const osc = cCtx.createOscillator();
                            const g = cCtx.createGain();
                            osc.type = "triangle";
                            osc.frequency.setValueAtTime(2400 + Math.random() * 800, tNow);
                            g.gain.setValueAtTime(0.008, tNow);
                            g.gain.exponentialRampToValueAtTime(0.0001, tNow + 0.08);
                            osc.connect(g);
                            g.connect(this.ambienceGain);
                            osc.start(tNow);
                            osc.stop(tNow + 0.1);
                        } else if (scene === "arena" && layers >= 3) {
                            // 观众呐喊远景微呼啸
                            const osc = cCtx.createOscillator();
                            const g = cCtx.createGain();
                            osc.type = "sine";
                            osc.frequency.setValueAtTime(180, tNow);
                            osc.frequency.linearRampToValueAtTime(240, tNow + 0.8);
                            g.gain.setValueAtTime(0.001, tNow);
                            g.gain.linearRampToValueAtTime(0.025, tNow + 0.4);
                            g.gain.exponentialRampToValueAtTime(0.0001, tNow + 0.9);
                            osc.connect(g);
                            g.connect(this.ambienceGain);
                            osc.start(tNow);
                            osc.stop(tNow + 1.0);
                        }
                    } catch {
                        // ignore
                    }
                }, scene === "stables" ? 4200 : (scene === "lobby" ? 2800 : 3500));
            }
        } catch {
            // ignore
        }
    }

    public static stopAmbience(): void {
        if (this.ambienceTimer !== null) {
            clearInterval(this.ambienceTimer);
            this.ambienceTimer = null;
        }
        for (const node of this.activeAmbienceNodes) {
            try {
                if ("stop" in node) {
                    (node as AudioScheduledSourceNode).stop();
                }
                node.disconnect();
            } catch {
                // ignore
            }
        }
        this.activeAmbienceNodes = [];
    }

    // ==========================================
    // 2. 交互音效层 (UI SFX)
    // ==========================================

    /** 普通按钮触碰：温和皮革按压下沉感 */
    public static playLeatherPress(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, true);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.05)) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(140, now + 0.04);

            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

            osc.connect(gain);
            gain.connect(targetGain);
            this.trackNode(mode, osc);

            osc.start(now);
            osc.stop(now + 0.05);
        } catch {
            // ignore
        }
    }

    /** 核心行动按钮：左轮撞针扳起上膛咔哒声 (Revolver Cock) */
    public static playRevolverCock(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, true);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.08)) return;

        try {
            const now = ctx.currentTime;
            // 两次快速金属咬合
            const clicks = [0, 0.045];
            const freqs = [1850, 2400];

            for (let i = 0; i < 2; i++) {
                const t = now + clicks[i];
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "triangle";
                osc.frequency.setValueAtTime(freqs[i], t);
                osc.frequency.exponentialRampToValueAtTime(700, t + 0.02);

                gain.gain.setValueAtTime(0.22, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

                osc.connect(gain);
                gain.connect(targetGain);
                this.trackNode(mode, osc);

                osc.start(t);
                osc.stop(t + 0.03);
            }
        } catch {
            // ignore
        }
    }

    /** 火漆印章沉重砸下封印声 (Wax Stamp Thud) */
    public static playStampThud(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, false);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.18)) return;

        try {
            const now = ctx.currentTime;

            // 低沉木板受击冲击波 (80Hz -> 40Hz)
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);

            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

            osc.connect(gain);
            gain.connect(targetGain);
            this.trackNode(mode, osc);

            osc.start(now);
            osc.stop(now + 0.17);
        } catch {
            // ignore
        }
    }

    /** 牛皮纸/悬赏令翻页声 (Parchment Flip) */
    public static playParchmentFlip(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, true);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.08)) return;

        try {
            const now = ctx.currentTime;
            // 白噪声擦纸声
            const bufferSize = Math.floor(ctx.sampleRate * 0.08);
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
            }

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = "bandpass";
            filter.frequency.setValueAtTime(1400, now);
            filter.Q.setValueAtTime(2.5, now);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.16, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(targetGain);
            this.trackNode(mode, noise);

            noise.start(now);
        } catch {
            // ignore
        }
    }

    /** 筹码选择碰撞清脆金属响 (Chip Clink) */
    public static playChipClink(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, true);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.09)) return;

        try {
            const now = ctx.currentTime;
            const freqs = [1568, 2093]; // G6, C7
            for (let i = 0; i < 2; i++) {
                const t = now + i * 0.025;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "sine";
                osc.frequency.setValueAtTime(freqs[i], t);
                osc.frequency.exponentialRampToValueAtTime(900, t + 0.06);

                gain.gain.setValueAtTime(0.18, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

                osc.connect(gain);
                gain.connect(targetGain);
                this.trackNode(mode, osc);

                osc.start(t);
                osc.stop(t + 0.08);
            }
        } catch {
            // ignore
        }
    }

    /** 马刺轻响调节倍率 (Spur Jingle) */
    public static playSpurJingle(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, true);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.05)) return;

        try {
            const now = ctx.currentTime;
            // 高频微碎齿轮声
            const freqs = [3200, 4100, 3600];
            for (let i = 0; i < 3; i++) {
                const t = now + i * 0.015;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "triangle";
                osc.frequency.setValueAtTime(freqs[i], t);

                gain.gain.setValueAtTime(0.12, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

                osc.connect(gain);
                gain.connect(targetGain);
                this.trackNode(mode, osc);

                osc.start(t);
                osc.stop(t + 0.04);
            }
        } catch {
            // ignore
        }
    }

    /** 边境下注公证黄铜钟声 (Copper Bell) */
    public static playCopperBell(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, false);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.5)) return;

        try {
            const now = ctx.currentTime;
            const freqs = [880, 1760, 2640]; // 谐波丰满的黄铜钟
            for (let i = 0; i < 3; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "sine";
                osc.frequency.setValueAtTime(freqs[i], now);

                const baseVol = 0.22 / (i + 1);
                gain.gain.setValueAtTime(baseVol, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

                osc.connect(gain);
                gain.connect(targetGain);
                this.trackNode(mode, osc);

                osc.start(now);
                osc.stop(now + 0.5);
            }
        } catch {
            // ignore
        }
    }

    /** 发令枪/终点绝杀枪响 (Gunshot Crack) */
    public static playGunshot(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, false);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.28)) return;

        try {
            const now = ctx.currentTime;

            // 1. 枪口爆鸣
            const bufferSize = Math.floor(ctx.sampleRate * 0.2);
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
            }

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(1800, now);
            filter.frequency.linearRampToValueAtTime(220, now + 0.18);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(targetGain);
            this.trackNode(mode, noise);

            noise.start(now);

            // 2. 尾音低频回响
            const lowOsc = ctx.createOscillator();
            const lowGain = ctx.createGain();
            lowOsc.type = "sine";
            lowOsc.frequency.setValueAtTime(160, now);
            lowOsc.frequency.exponentialRampToValueAtTime(45, now + 0.25);

            lowGain.gain.setValueAtTime(0.3, now);
            lowGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            lowOsc.connect(lowGain);
            lowGain.connect(targetGain);
            this.trackNode(mode, lowOsc);

            lowOsc.start(now);
            lowOsc.stop(now + 0.26);
        } catch {
            // ignore
        }
    }

    /** 开启马蹄奔驰循环 (Gallop Loop) - 含随机环境马匹呼吸/打鼻息氛围声 */
    public static startGallopLoop(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled || this.isGalloping) return;
        this.isGalloping = true;

        let step = 0;
        let lastSnortStep = 0;
        this.gallopTimer = setInterval(() => {
            const ctx = this.getContext();
            const targetGain = this.getTargetGain(mode, false);
            if (!ctx || !targetGain || !this.soundEnabled) return;
            if (!this.registerModeSound(mode, 0.2)) return;

            try {
                const now = ctx.currentTime;
                // 真实四拍马蹄节拍，微弱随机化节律模拟多匹马蹄交错
                const jitter = (Math.random() - 0.5) * 0.012;
                const delays = [0, 0.055 + jitter];
                const freqs = step % 2 === 0
                    ? [300 + Math.random() * 30, 220 + Math.random() * 20]
                    : [260 + Math.random() * 25, 190 + Math.random() * 15];

                for (let i = 0; i < 2; i++) {
                    const t = now + delays[i];
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc.type = "triangle";
                    osc.frequency.setValueAtTime(freqs[i], t);
                    osc.frequency.exponentialRampToValueAtTime(75, t + 0.04);

                    // 随着奔跑进行，马蹄声压微弱波动，模拟赛场多马踏步不齐
                    const vol = 0.12 + Math.random() * 0.05;
                    gain.gain.setValueAtTime(vol, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

                    osc.connect(gain);
                    gain.connect(targetGain);
                    this.trackNode(mode, osc);

                    osc.start(t);
                    osc.stop(t + 0.05);
                }

                // 每约 4.5 秒 (~21 步) 以 45% 概率触发一次随机马匹响鼻氛围声
                if (step - lastSnortStep > 21 && Math.random() < 0.45) {
                    lastSnortStep = step;
                    this.playHorseSnort(mode);
                }

                step++;
            } catch {
                // ignore
            }
        }, 210); // 约 280 步/分疾驰频率
    }

    public static stopGallopLoop(): void {
        this.isGalloping = false;
        if (this.gallopTimer !== null) {
            clearInterval(this.gallopTimer);
            this.gallopTimer = null;
        }
    }

    /** 终点冲线号角短奏与烈马胜利长嘶 (Race Finish Fanfare) */
    public static playRaceFinishFanfare(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, false);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.7)) return;

        try {
            const now = ctx.currentTime;

            // 1. 铜号冲线大三和弦短奏 (Brass Fanfare: D5-F#5-A5)
            const fanfareFreqs = [587, 740, 880];
            for (let i = 0; i < fanfareFreqs.length; i++) {
                const t = now + i * 0.08;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(fanfareFreqs[i], t);

                gain.gain.setValueAtTime(0.001, t);
                gain.gain.linearRampToValueAtTime(0.16, t + 0.04);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

                osc.connect(gain);
                gain.connect(targetGain);
                this.trackNode(mode, osc);

                osc.start(t);
                osc.stop(t + 0.32);
            }

            // 2. 延迟 0.35s 后触发胜利马匹长嘶
            setTimeout(() => {
                this.playHorseNeigh(mode);
            }, 350);
        } catch {
            // ignore
        }
    }

    /** 胜利大结算：金币瀑布飞溅 + 口琴琶音 (Gold Cascade) */
    public static playGoldCascade(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, false);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.6)) return;

        try {
            const now = ctx.currentTime;

            // 1. 金币飞溅琶音 (C5 -> E5 -> G5 -> C6 -> E6)
            const notes = [523, 659, 784, 1046, 1318, 1568];
            for (let i = 0; i < notes.length; i++) {
                const t = now + i * 0.06;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "sine";
                osc.frequency.setValueAtTime(notes[i], t);

                gain.gain.setValueAtTime(0.2, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

                osc.connect(gain);
                gain.connect(targetGain);
                this.trackNode(mode, osc);

                osc.start(t);
                osc.stop(t + 0.2);
            }
        } catch {
            // ignore
        }
    }

    /** 惜败低音闷弦 (Muted Guitar) */
    public static playMutedGuitar(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, false);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.3)) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(146, now);
            osc.frequency.exponentialRampToValueAtTime(73, now + 0.25);

            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

            osc.connect(gain);
            gain.connect(targetGain);
            this.trackNode(mode, osc);

            osc.start(now);
            osc.stop(now + 0.28);
        } catch {
            // ignore
        }
    }

    /** 沙龙摇摆木门推开声 (Saloon Door Swing) */
    public static playSaloonDoor(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, true);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.08)) return;

        try {
            const now = ctx.currentTime;
            // 两次木门摆动轻碰 (低沉原木碰撞)
            const swings = [0, 0.08];
            const freqs = [180, 150];

            for (let i = 0; i < 2; i++) {
                const t = now + swings[i];
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "triangle";
                osc.frequency.setValueAtTime(freqs[i], t);
                osc.frequency.exponentialRampToValueAtTime(60, t + 0.05);

                gain.gain.setValueAtTime(0.16, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

                osc.connect(gain);
                gain.connect(targetGain);
                this.trackNode(mode, osc);

                osc.start(t);
                osc.stop(t + 0.07);
            }
        } catch {
            // ignore
        }
    }

    /** 弹窗卷轴拉开舒展声 (Scroll Unfurl) */
    public static playScrollUnfurl(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, true);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.12)) return;

        try {
            const now = ctx.currentTime;
            const bufferSize = Math.floor(ctx.sampleRate * 0.12);
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
            }

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = "bandpass";
            filter.frequency.setValueAtTime(900, now);
            filter.frequency.linearRampToValueAtTime(1600, now + 0.12);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(targetGain);
            this.trackNode(mode, noise);

            noise.start(now);
        } catch {
            // ignore
        }
    }

    /** 边境电报机节律滴答 (Telegraph Beep) */
    public static playTelegraphBeep(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, true);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.05)) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(800, now);

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

            osc.connect(gain);
            gain.connect(targetGain);
            this.trackNode(mode, osc);

            osc.start(now);
            osc.stop(now + 0.05);
        } catch {
            // ignore
        }
    }

    /** 赛马并驾齐驱紧张弦乐短句 (Neck and Neck Tension) */
    public static playNeckAndNeckTension(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, false);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.38)) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(220, now); // A3
            osc.frequency.linearRampToValueAtTime(440, now + 0.3); // 滑音冲线

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc.connect(gain);
            gain.connect(targetGain);
            this.trackNode(mode, osc);

            osc.start(now);
            osc.stop(now + 0.36);
        } catch {
            // ignore
        }
    }

    /** 兼容旧代码的点击音效 */
    public static playClick(mode: AudioPlayMode = "COMMON"): void {
        this.playLeatherPress(mode);
    }

    /** 皮鞭扬鞭抽打声 (Whip Crack) */
    public static playWhip(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, false);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.09)) return;

        try {
            const now = ctx.currentTime;
            const bufferSize = Math.floor(ctx.sampleRate * 0.08);
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
            }

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = "highpass";
            filter.frequency.setValueAtTime(2200, now);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(targetGain);
            this.trackNode(mode, noise);

            noise.start(now);
        } catch {
            // ignore
        }
    }

    /** 胜利音效 (Win) */
    public static playWin(mode: AudioPlayMode = "COMMON"): void {
        this.playGoldCascade(mode);
    }

    /** 惜败音效 (Lose) */
    public static playLose(mode: AudioPlayMode = "COMMON"): void {
        this.playMutedGuitar(mode);
    }

    /** 比赛起跑发令音 (Race Start) */
    public static playRaceStart(mode: AudioPlayMode = "COMMON"): void {
        this.playGunshot(mode);
    }

    /** 开始马蹄声 (Start Gallop) */
    public static startGallop(mode: AudioPlayMode = "COMMON"): void {
        this.startGallopLoop(mode);
    }

    /** 停止马蹄声 (Stop Gallop) */
    public static stopGallop(): void {
        this.stopGallopLoop();
    }

    /** 播放单次马蹄沉重踏步 */
    public static playGallop(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, false);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.06)) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "triangle";
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(70, now + 0.045);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

            osc.connect(gain);
            gain.connect(targetGain);
            this.trackNode(mode, osc);

            osc.start(now);
            osc.stop(now + 0.05);
        } catch {
            // ignore
        }
    }

    /** 筹码下注音效 (Bet Sound) */
    public static playBet(mode: AudioPlayMode = "COMMON"): void {
        this.playChipClink(mode);
    }

    // ==========================================
    // 3. 西部牛仔原声与马匹拟真声效引擎 (Cowboy & Horse Vocals)
    // ==========================================

    /** 骏马长嘶 (Horse Whinny / Neigh): 真实声道共鸣与喉颤音算法合成 */
    public static playHorseNeigh(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, false);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 1.1)) return;

        try {
            const now = ctx.currentTime;
            const duration = 1.05;

            // 1. 载波振荡器 (模拟马鸣主基频 820Hz -> 1820Hz -> 620Hz)
            const carrier = ctx.createOscillator();
            carrier.type = "sawtooth";
            carrier.frequency.setValueAtTime(820, now);
            carrier.frequency.exponentialRampToValueAtTime(1820, now + 0.26);
            carrier.frequency.exponentialRampToValueAtTime(1420, now + 0.6);
            carrier.frequency.exponentialRampToValueAtTime(620, now + duration);

            // 2. 喉颤调制器 (22Hz 深度颤音，带来逼真的马匹唇带共鸣)
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            lfo.type = "sine";
            lfo.frequency.setValueAtTime(22, now);
            lfoGain.gain.setValueAtTime(95, now);
            lfoGain.gain.linearRampToValueAtTime(140, now + 0.32);
            lfoGain.gain.linearRampToValueAtTime(35, now + duration);
            lfo.connect(lfoGain);
            lfoGain.connect(carrier.frequency);

            // 3. 马腔共鸣带通滤波器 (Formant Filter 模拟口腔结构)
            const formant = ctx.createBiquadFilter();
            formant.type = "bandpass";
            formant.frequency.setValueAtTime(1420, now);
            formant.Q.setValueAtTime(3.0, now);

            // 4. 音量包络
            const mainGain = ctx.createGain();
            mainGain.gain.setValueAtTime(0.001, now);
            mainGain.gain.linearRampToValueAtTime(0.24, now + 0.14);
            mainGain.gain.exponentialRampToValueAtTime(0.16, now + 0.58);
            mainGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            carrier.connect(formant);
            formant.connect(mainGain);
            mainGain.connect(targetGain);
            this.trackNode(mode, carrier);
            this.trackNode(mode, lfo);

            // 5. 嘶鸣末尾喷气呼声 (Nasal breath hiss)
            const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.35), ctx.sampleRate);
            const data = noiseBuf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.sin((i / data.length) * Math.PI);
            }
            const breath = ctx.createBufferSource();
            breath.buffer = noiseBuf;
            const breathFilter = ctx.createBiquadFilter();
            breathFilter.type = "bandpass";
            breathFilter.frequency.setValueAtTime(900, now + 0.65);
            const breathGain = ctx.createGain();
            breathGain.gain.setValueAtTime(0.001, now + 0.65);
            breathGain.gain.linearRampToValueAtTime(0.08, now + 0.8);
            breathGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65 + 0.35);
            breath.connect(breathFilter);
            breathFilter.connect(breathGain);
            breathGain.connect(targetGain);
            this.trackNode(mode, breath);

            carrier.start(now);
            lfo.start(now);
            breath.start(now + 0.65);

            carrier.stop(now + duration);
            lfo.stop(now + duration);
        } catch {
            // ignore
        }
    }

    /** 马儿低沉打响鼻 (Horse Snort / Chuff) */
    public static playHorseSnort(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, false);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.28)) return;

        try {
            const now = ctx.currentTime;
            const duration = 0.26;

            const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buf;

            const filter = ctx.createBiquadFilter();
            filter.type = "bandpass";
            filter.frequency.setValueAtTime(500, now);
            filter.Q.setValueAtTime(2.2, now);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.22, now + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(targetGain);
            this.trackNode(mode, noise);

            noise.start(now);
        } catch {
            // ignore
        }
    }

    /** 响亮牛仔皮鞭炸响 (Bullwhip Crack): 破空呼啸 + 超音速音爆破音 */
    public static playBullwhip(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, false);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.18)) return;

        try {
            const now = ctx.currentTime;

            // 1. 破空呼啸声 (Whoosh 700Hz -> 3000Hz)
            const whoosh = ctx.createOscillator();
            const whooshGain = ctx.createGain();
            whoosh.type = "sine";
            whoosh.frequency.setValueAtTime(700, now);
            whoosh.frequency.exponentialRampToValueAtTime(3000, now + 0.065);
            whooshGain.gain.setValueAtTime(0.001, now);
            whooshGain.gain.linearRampToValueAtTime(0.18, now + 0.045);
            whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
            whoosh.connect(whooshGain);
            whooshGain.connect(targetGain);
            this.trackNode(mode, whoosh);
            whoosh.start(now);
            whoosh.stop(now + 0.075);

            // 2. 超音速鞭梢破音 (Supersonic Snap)
            const snapTime = now + 0.065;
            const bufSize = Math.floor(ctx.sampleRate * 0.1);
            const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
                d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.06));
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buf;

            const highPass = ctx.createBiquadFilter();
            highPass.type = "highpass";
            highPass.frequency.setValueAtTime(2400, snapTime);

            const snapGain = ctx.createGain();
            snapGain.gain.setValueAtTime(0.4, snapTime);
            snapGain.gain.exponentialRampToValueAtTime(0.001, snapTime + 0.1);

            noise.connect(highPass);
            highPass.connect(snapGain);
            snapGain.connect(targetGain);
            this.trackNode(mode, noise);
            noise.start(snapTime);
        } catch {
            // ignore
        }
    }

    /** 合成牛仔狂野呐喊 "Yee-Haw!" (Dual Formant Vocal Synthesis) */
    public static playYeeHaw(mode: AudioPlayMode = "COMMON"): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        const targetGain = this.getTargetGain(mode, false);
        if (!ctx || !targetGain || !this.registerModeSound(mode, 0.4)) return;

        try {
            const now = ctx.currentTime;

            // 第一音节 "YEE" (0.0s ~ 0.22s, 上扬狂热)
            const yeeOsc = ctx.createOscillator();
            yeeOsc.type = "sawtooth";
            yeeOsc.frequency.setValueAtTime(360, now);
            yeeOsc.frequency.exponentialRampToValueAtTime(520, now + 0.18);

            const yeeF1 = ctx.createBiquadFilter();
            yeeF1.type = "bandpass";
            yeeF1.frequency.setValueAtTime(320, now);
            yeeF1.Q.setValueAtTime(3.8, now);

            const yeeF2 = ctx.createBiquadFilter();
            yeeF2.type = "bandpass";
            yeeF2.frequency.setValueAtTime(2200, now);
            yeeF2.Q.setValueAtTime(4.5, now);

            const yeeGain = ctx.createGain();
            yeeGain.gain.setValueAtTime(0.001, now);
            yeeGain.gain.linearRampToValueAtTime(0.24, now + 0.04);
            yeeGain.gain.exponentialRampToValueAtTime(0.08, now + 0.2);

            yeeOsc.connect(yeeF1);
            yeeOsc.connect(yeeF2);
            yeeF1.connect(yeeGain);
            yeeF2.connect(yeeGain);
            yeeGain.connect(targetGain);
            this.trackNode(mode, yeeOsc);

            yeeOsc.start(now);
            yeeOsc.stop(now + 0.21);

            // 第二音节 "HAW!" (0.22s ~ 0.58s, 粗犷下落)
            const hawTime = now + 0.2;
            const hawOsc = ctx.createOscillator();
            hawOsc.type = "sawtooth";
            hawOsc.frequency.setValueAtTime(500, hawTime);
            hawOsc.frequency.exponentialRampToValueAtTime(280, hawTime + 0.32);

            const hawF1 = ctx.createBiquadFilter();
            hawF1.type = "bandpass";
            hawF1.frequency.setValueAtTime(760, hawTime);
            hawF1.Q.setValueAtTime(3.2, hawTime);

            const hawF2 = ctx.createBiquadFilter();
            hawF2.type = "bandpass";
            hawF2.frequency.setValueAtTime(1180, hawTime);
            hawF2.Q.setValueAtTime(3.8, hawTime);

            const hawGain = ctx.createGain();
            hawGain.gain.setValueAtTime(0.001, hawTime);
            hawGain.gain.linearRampToValueAtTime(0.26, hawTime + 0.04);
            hawGain.gain.exponentialRampToValueAtTime(0.001, hawTime + 0.35);

            hawOsc.connect(hawF1);
            hawOsc.connect(hawF2);
            hawF1.connect(hawGain);
            hawF2.connect(hawGain);
            hawGain.connect(targetGain);
            this.trackNode(mode, hawOsc);

            hawOsc.start(hawTime);
            hawOsc.stop(hawTime + 0.37);
        } catch {
            // ignore
        }
    }

    // 上一次牛仔喊话时间戳，避免语音撞车重叠
    private static lastCowboyVoiceTime = 0;

    /**
     * 播放纯正美式西部牛仔原声口音语音 (Cowboy Accent Voice)
     * 集成 Web Speech API (带音调 pitch 0.82 粗犷牛仔拉长腔 + rate 1.12 疾驰语速)
     * 当浏览器不支持语音时，无缝降级为算法生成的牛仔呐喊、皮鞭与马嘶！
     */
    public static speakCowboy(
        cue: "start" | "overtake" | "duel" | "win" | "lose" | "spurs" | "bet",
        mode: AudioPlayMode = "COMMON",
    ): void {
        if (!this.soundEnabled) return;

        // 非当前激活模式且非公共语音一律拦截
        if (mode !== "COMMON" && mode !== this.activeMode) {
            return;
        }

        // 处于“切换模式等待下个音效”状态时，若此语音触发，则作为下一个全新音效恢复播放
        if (mode !== "COMMON" && this.modeWaitingForNextSound[mode]) {
            this.modeWaitingForNextSound[mode] = false;
            const targetGain = mode === "WIN" ? this.winSfxGain : this.quinellaSfxGain;
            if (targetGain && this.ctx) {
                targetGain.gain.cancelScheduledValues(this.ctx.currentTime);
                targetGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
            }
            const otherMode = mode === "WIN" ? "QUINELLA" : "WIN";
            const otherGain = otherMode === "WIN" ? this.winSfxGain : this.quinellaSfxGain;
            if (otherGain && this.ctx) {
                otherGain.gain.cancelScheduledValues(this.ctx.currentTime);
                otherGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
            }
            if (this.currentSpeakingMode === otherMode) {
                if (typeof window !== "undefined" && "speechSynthesis" in window) {
                    try {
                        window.speechSynthesis.cancel();
                    } catch {
                        // ignore
                    }
                }
                this.currentSpeakingMode = null;
                if (this.currentSpeakingTimer !== null) {
                    clearTimeout(this.currentSpeakingTimer);
                    this.currentSpeakingTimer = null;
                }
            }
        }

        const nowMs = Date.now();
        // 防连续高频撞车（至少间隔 1.4 秒）
        if (nowMs - this.lastCowboyVoiceTime < 1400) {
            return;
        }
        this.lastCowboyVoiceTime = nowMs;

        // 根据情境挑选经典地道西部牛仔口音台词
        const phraseMap: Record<string, string[]> = {
            start: [
                "Yee-haw! Giddy up, boys!",
                "Fire in the hole! Let 'em ride!",
                "Crack that whip! Go, go, go!",
            ],
            overtake: [
                "Look at 'em dust! Coming in hot on the outside!",
                "Outta my way, partner! Make room for the champ!",
                "Holy smoke! Look at that surge!",
            ],
            duel: [
                "Hold your horses! They're neck and neck in the stretch!",
                "By the spurs of Texas! It's a two-horse brawl!",
                "Down to the wire, partner! Neck and neck!",
            ],
            win: [
                "Yee-haw! That's how a real cowboy rides! Jackpot is ours!",
                "Hot damn! Winner takes the bounty! Drinks are on me!",
            ],
            lose: [
                "Well, butter my biscuits... We'll get 'em next round, cowboy.",
                "Ah, spit in the dust! Dust off your boots and saddle up!",
            ],
            spurs: [
                "Hyaa! Move it, beauty!",
                "Giddy up! Run like the prairie wind!",
            ],
            bet: [
                "Chips on the wood! Let 'er buck!",
                "A true frontiersman bet! Ride high, partner!",
            ],
        };

        const phrases = phraseMap[cue] || phraseMap.start;
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];

        // 伴随特征拟音叠加，加强现场感
        if (cue === "start") {
            this.playHorseNeigh(mode);
        } else if (cue === "overtake") {
            this.playBullwhip(mode);
        } else if (cue === "duel") {
            this.playHorseNeigh(mode);
            this.playNeckAndNeckTension(mode);
        } else if (cue === "spurs") {
            this.playBullwhip(mode);
        } else if (cue === "win") {
            this.playYeeHaw(mode);
        }

        // 尝试调用浏览器语音合成 (SpeechSynthesis)
        if (
            typeof window !== "undefined" &&
            "speechSynthesis" in window &&
            typeof SpeechSynthesisUtterance !== "undefined"
        ) {
            try {
                // 优先播放切换前模式的声音：若原模式正在发声，不粗暴打断
                if (this.currentSpeakingMode && this.currentSpeakingMode !== mode && this.modePlaying[this.currentSpeakingMode]) {
                    return;
                }

                window.speechSynthesis.cancel();
                if (mode !== "COMMON") {
                    this.currentSpeakingMode = mode;
                    this.modePlaying[mode] = true;
                }

                const utterance = new SpeechSynthesisUtterance(phrase);
                utterance.lang = "en-US";
                // 粗犷西部牛仔拉长音调与快节奏特色
                utterance.pitch = 0.82;
                utterance.rate = 1.14;
                utterance.volume = Math.max(0.1, Math.min(1.0, this.sfxVolume * 0.95));

                const cleanupSpeech = () => {
                    if (mode !== "COMMON" && this.currentSpeakingMode === mode) {
                        this.currentSpeakingMode = null;
                        if (this.activeModeNodes[mode].length === 0) {
                            this.modePlaying[mode] = false;
                            if (this.activeMode !== mode && this.ctx) {
                                const gainNode = mode === "WIN" ? this.winSfxGain : this.quinellaSfxGain;
                                if (gainNode) {
                                    gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
                                    gainNode.gain.setValueAtTime(0.0, this.ctx.currentTime);
                                }
                            }
                        }
                    }
                };

                utterance.onend = () => {
                    cleanupSpeech();
                };
                utterance.onerror = () => {
                    cleanupSpeech();
                };

                if (this.currentSpeakingTimer !== null) {
                    clearTimeout(this.currentSpeakingTimer);
                }
                this.currentSpeakingTimer = setTimeout(() => {
                    cleanupSpeech();
                }, 4000);

                // 优先寻找美式英语原生男声
                const voices = window.speechSynthesis.getVoices();
                if (voices && voices.length > 0) {
                    const usMale = voices.find(
                        (v) =>
                            v.lang.toLowerCase().includes("en") &&
                            (v.name.toLowerCase().includes("male") ||
                                v.name.toLowerCase().includes("david") ||
                                v.name.toLowerCase().includes("george") ||
                                v.name.toLowerCase().includes("natural")),
                    );
                    const usAny = voices.find((v) => v.lang.toLowerCase().includes("en-us"));
                    if (usMale) {
                        utterance.voice = usMale;
                    } else if (usAny) {
                        utterance.voice = usAny;
                    }
                }

                window.speechSynthesis.speak(utterance);
            } catch {
                // 降级兜底已由前面的拟音完成
            }
        }
    }
}

