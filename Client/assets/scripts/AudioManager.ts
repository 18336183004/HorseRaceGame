/**
 * 纯程序 WebAudio 声音合成引擎。
 * 遵循 racegame-project-standards 规范，严禁 any。
 * 零外部 mp3 资源依赖，利用 Web Audio API 动态合成起跑发令枪、马蹄奔跑、筹码下注与胜利号角。
 */
export class AudioManager {
    private static ctx: AudioContext | null = null;
    private static soundEnabled = true;
    private static musicEnabled = true;
    private static gallopTimer: ReturnType<typeof setInterval> | null = null;

    /** 初始化或获取 AudioContext，兼容主流移动端与桌面浏览器。 */
    private static getContext(): AudioContext | null {
        if (typeof window === "undefined") {
            return null;
        }
        if (!this.ctx) {
            const AudioCtx =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === "suspended") {
            void this.ctx.resume();
        }
        return this.ctx;
    }

    /** 更新音效开关。 */
    public static setSoundEnabled(enabled: boolean): void {
        this.soundEnabled = enabled;
        if (!enabled) {
            this.stopGallop();
        }
    }

    /** 更新音乐开关。 */
    public static setMusicEnabled(enabled: boolean): void {
        this.musicEnabled = enabled;
    }

    public static isSoundEnabled(): boolean {
        return this.soundEnabled;
    }

    public static isMusicEnabled(): boolean {
        return this.musicEnabled;
    }

    /** 播放按钮点击音效 (清脆 750Hz -> 400Hz 快速正弦波)。 */
    public static playClick(): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            const now = ctx.currentTime;
            osc.type = "sine";
            osc.frequency.setValueAtTime(750, now);
            osc.frequency.exponentialRampToValueAtTime(350, now + 0.05);

            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.05);
        } catch {
            // 忽略浏览器音频权限未就绪异常
        }
    }

    /** 播放筹码下注音效 (清脆金属双音阶金币叮当声)。 */
    public static playBet(): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const freqs = [987, 1318]; // B5 与 E6 谐波
            for (let i = 0; i < freqs.length; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                const startTime = now + i * 0.04;
                osc.type = "triangle";
                osc.frequency.setValueAtTime(freqs[i], startTime);

                gain.gain.setValueAtTime(0.2, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(startTime);
                osc.stop(startTime + 0.18);
            }
        } catch {
            // 忽略异常
        }
    }

    /** 播放比赛起跑发令音 (发令枪白噪声爆鸣 + 起跑号角)。 */
    public static playRaceStart(): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;

            // 1. 发令枪声：爆破噪声
            const bufferSize = Math.floor(ctx.sampleRate * 0.15);
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
            }

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(1000, now);
            filter.frequency.linearRampToValueAtTime(150, now + 0.15);

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.35, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(ctx.destination);

            noise.start(now);

            // 2. 起跑电子发令三短一长提示
            const beepFreqs = [587, 587, 880];
            for (let i = 0; i < beepFreqs.length; i++) {
                const osc = ctx.createOscillator();
                const beepGain = ctx.createGain();
                const t = now + 0.12 + i * 0.1;

                osc.type = "sine";
                osc.frequency.setValueAtTime(beepFreqs[i], t);

                beepGain.gain.setValueAtTime(0.15, t);
                beepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

                osc.connect(beepGain);
                beepGain.connect(ctx.destination);

                osc.start(t);
                osc.stop(t + 0.08);
            }
        } catch {
            // 忽略异常
        }
    }

    /** 开启比赛中循环马蹄声 ("嗒-嗒，嗒-嗒" 节奏节奏音)。 */
    public static startGallop(): void {
        if (!this.soundEnabled || this.gallopTimer !== null) return;

        let step = 0;
        this.gallopTimer = setInterval(() => {
            const ctx = this.getContext();
            if (!ctx) return;

            try {
                const now = ctx.currentTime;
                // 双击马蹄节拍：第一声与第二声间隔 70ms
                const delays = [0, 0.07];
                const freqs = step % 2 === 0 ? [320, 240] : [280, 210];

                for (let i = 0; i < 2; i++) {
                    const t = now + delays[i];
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc.type = "triangle";
                    osc.frequency.setValueAtTime(freqs[i], t);
                    osc.frequency.exponentialRampToValueAtTime(80, t + 0.04);

                    gain.gain.setValueAtTime(0.12, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    osc.start(t);
                    osc.stop(t + 0.04);
                }
                step++;
            } catch {
                // 忽略异常
            }
        }, 220); // 约 270 步/分钟真实马匹疾驰步频
    }

    /** 停止马蹄奔跑循环音。 */
    public static stopGallop(): void {
        if (this.gallopTimer !== null) {
            clearInterval(this.gallopTimer);
            this.gallopTimer = null;
        }
    }

    /** 播放单次马蹄沉重踏步与扬尘音效。 */
    public static playGallop(): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const delays = [0, 0.06];
            const freqs = [360, 240];

            for (let i = 0; i < 2; i++) {
                const t = now + delays[i];
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "triangle";
                osc.frequency.setValueAtTime(freqs[i], t);
                osc.frequency.exponentialRampToValueAtTime(70, t + 0.05);

                gain.gain.setValueAtTime(0.25, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(t);
                osc.stop(t + 0.05);
            }
        } catch {
            // ignore
        }
    }

    /** 播放牛仔甩鞭清脆裂空声 (Whip crack)。 */
    public static playWhip(): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(2200, now);
            osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);

            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.08);
        } catch {
            // ignore
        }
    }

    /** 播放获胜结算号角 (C大调四和弦琶音 C5 -> E5 -> G5 -> C6)。 */
    public static playWin(): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
            const now = ctx.currentTime;

            for (let i = 0; i < notes.length; i++) {
                const t = now + i * 0.1;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "triangle";
                osc.frequency.setValueAtTime(notes[i], t);

                const dur = i === notes.length - 1 ? 0.6 : 0.2;
                gain.gain.setValueAtTime(0.25, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(t);
                osc.stop(t + dur);
            }
        } catch {
            // 忽略异常
        }
    }

    /** 播放未中奖音效 (轻柔下行双音)。 */
    public static playLose(): void {
        if (!this.soundEnabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const notes = [330, 260];
            const now = ctx.currentTime;

            for (let i = 0; i < notes.length; i++) {
                const t = now + i * 0.16;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "sine";
                osc.frequency.setValueAtTime(notes[i], t);

                gain.gain.setValueAtTime(0.18, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(t);
                osc.stop(t + 0.25);
            }
        } catch {
            // 忽略异常
        }
    }
}
