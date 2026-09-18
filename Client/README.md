# HorseRaceGame Client V2.0

- Engine: Cocos Creator 3.8.8
- Design resolution: 720×1280
- Runtime API/SignalR address comes from `__RACE_GAME_CONFIG__`; local fallback is `http://localhost:55230`.
- Business version: 2.0.0

## Pages

Login / Register / Lobby / Wallet / Race / Result / Tasks / Stable / Characters / Ranking / Shop / Bets / Notices / Settings.

## Authority

The client never decides odds, final ranking, wallet balance or settlement. Race animation is driven by server timestamps and animation parameters.

## Current product boundary

Only in-game virtual COIN is supported. No cash recharge, withdrawal, crypto, USDT or player-to-player coin transfer UI is shipped.
