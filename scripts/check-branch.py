import json, subprocess

def api(path):
    out = subprocess.run(["gh", "api", path], capture_output=True, text=True, encoding="utf-8")
    return out.returncode, out.stdout, out.stderr

code, out, err = api("repos/nxz1026/awesome-dsh-plugin/branches/add-dsh-tray")
if code == 0:
    b = json.loads(out)
    print("fork branch :", b["name"], "@", b["commit"]["sha"][:7])
else:
    print("fork branch : MISSING", err[:100])

code, out, err = api("repos/awesome-dsh-plugin/awesome-dsh-plugin/branches/main")
b = json.loads(out)
print("upstream main:", b["name"], "@", b["commit"]["sha"][:7])
