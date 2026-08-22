# repos topic 整理助手：pnpm exec 不需要，直接 python
import json, subprocess, sys

def api(path):
    out = subprocess.run(["gh", "api", path], capture_output=True, text=True, encoding="utf-8")
    if out.returncode != 0:
        print("ERR:", out.stderr[:200]); sys.exit(1)
    return json.loads(out.stdout)

def set_topics(repo, topics):
    body = json.dumps({"names": topics})
    subprocess.run(["gh", "api", "-X", "PUT", f"repos/nxz1026/{repo}/topics",
                    "--input", "-", "--input", body], capture_output=True, text=True)

# 0. SinglePlayer（本仓库）当前状态
r = api("repos/nxz1026/SinglePlayer")
print("SinglePlayer | lang:", r["language"], "| desc:", r.get("description"), "| topics:", r.get("topics"))

# 1. HaloLyricSync 当前状态
r = api("repos/nxz1026/HaloLyricSync")
print("HaloLyricSync | lang:", r["language"], "| desc:", r.get("description"), "| topics:", r.get("topics"))

# 2. 找出所有 predict 相关仓库
search = api("search/repositories?q=user:nxz1026+predict+in:name&per_page=20")
for item in search.get("items", []):
    print("PREDICT:", item["name"], "| lang:", item["language"], "| desc:", item.get("description"))
