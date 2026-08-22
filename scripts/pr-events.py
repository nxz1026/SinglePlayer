import json, subprocess

out = subprocess.run(
    ["gh", "api", "repos/awesome-dsh-plugin/awesome-dsh-plugin/issues/2729/events"],
    capture_output=True, text=True, encoding="utf-8")
events = json.loads(out.stdout)
for e in events:
    actor = (e.get("actor") or {}).get("login", "system")
    print(f"{e.get('created_at','')}  {e.get('event'):20s} {actor}")
