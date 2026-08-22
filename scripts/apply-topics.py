import json, os, subprocess, tempfile

def _api_input(path, body):
    """通过临时文件给 gh api 传 JSON body，避免 stdin 编码问题。"""
    fd, tmp = tempfile.mkstemp(suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(body)
        return subprocess.run(["gh", "api", "-X", "PUT", path,
                               "--input", tmp], capture_output=True, text=True, encoding="utf-8")
    finally:
        os.unlink(tmp)

def set_topics(repo, topics):
    r = _api_input(f"repos/nxz1026/{repo}/topics", json.dumps({"names": topics}))
    status = "OK" if r.returncode == 0 else "FAIL: " + (r.stderr or "")[:150]
    print(f"{repo}: {len(topics)} topics -> {status}")

def set_desc(repo, desc):
    _api_input(f"repos/nxz1026/{repo}", json.dumps({"description": desc}))
    print(f"{repo}: description updated")

# 0) SinglePlayer（本仓库）：凸显 AI 与 DSH 插件化
set_topics("SinglePlayer", [
    "dsh-plugin", "deepseek", "deepseek-harness",
    "ai-agent", "music-player",
    "netease-cloud-music", "qq-music",
    "karaoke", "lyrics", "usb-hid", "halo-pixelbar",
    "react", "typescript",
])
set_desc("SinglePlayer",
         "AI-native music player plugin for DeepSeek Harness (dsh): NetEase/QQ aggregation, "
         "word-level karaoke, 12 conversational AI tools, HALO PixelBar USB-HID lyric sync.")

# 1) HaloLyricSync
set_topics("HaloLyricSync", [
    "python", "lyrics", "lrc", "lyrics-sync", "usb-hid", "hid",
    "lx-music", "halo-pixelbar",
])
set_desc("HaloLyricSync", "Sync LRC lyrics to the HALO PIXELBAR speaker over USB HID via LX Music open API.")

# 2) league-predict
set_topics("league-predict", [
    "python", "football", "soccer", "prediction", "sports-analytics",
    "elo-rating", "dixon-coles", "poisson", "monte-carlo-simulation",
    "betting-odds", "xgboost", "machine-learning",
])
set_desc("league-predict", "Football match prediction pipeline: multi-source odds de-vig, signal model, ELO, Dixon-Coles bivariate Poisson and Monte Carlo simulation.")

# 3) basketball-predict
set_topics("basketball-predict", [
    "python", "basketball", "nba", "prediction", "sports-analytics",
    "elo-rating", "machine-learning",
])
set_desc("basketball-predict", "NBA game prediction with ELO ratings plus team efficiency model.")

# 4) welfare_predict
set_topics("welfare_predict", [
    "python", "lottery", "china-welfare-lottery", "lstm", "tensorflow",
    "number-generator", "entertainment",
])
set_desc("welfare_predict", "Welfare lottery number recommender (Shuangseqiu / 3D / Qilecai / Kuaile 8) with LSTM models - entertainment only.")
