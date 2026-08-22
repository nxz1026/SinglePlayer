import subprocess, sys

def raw_readme(repo):
    for branch in ("main", "master"):
        out = subprocess.run(
            ["curl.exe", "-sS", "--ssl-no-revoke",
             f"https://raw.githubusercontent.com/nxz1026/{repo}/{branch}/README.md"],
            capture_output=True)
        if out.returncode == 0 and out.stdout:
            return out.stdout.decode("utf-8", errors="replace")
    return ""

for repo in ("league-predict", "basketball-predict", "welfare_predict"):
    text = raw_readme(repo)
    print(f"===== {repo} =====")
    head = "\n".join(text.splitlines()[:25])
    print(head if head.strip() else "(无 README 或读取失败)")
    # 找 requirements/依赖线索
    import re
    kws = re.findall(r"(?i)(xgboost|lightgbm|sklearn|scikit|torch|tensorflow|elo|poisson|lstm|transformer|odds|spider|crawl)", text)
    print("关键词:", sorted(set(k.lower() for k in kws)))
    print()
