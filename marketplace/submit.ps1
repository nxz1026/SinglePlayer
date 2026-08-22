# 向 awesome-dsh-plugin 插件市场投稿
# 用法（仓库需创建满 1 天后执行）：
#   powershell -ExecutionPolicy Bypass -File marketplace\submit.ps1
#
# 前置：gh CLI 已登录；本仓库已添加 topic dsh-plugin

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$upstream = 'awesome-dsh-plugin/awesome-dsh-plugin'
$branch   = 'add-single-player'
$workdir  = "$env:TEMP\awesome-dsh-submit"

# 1) fork（已存在则跳过）
gh repo fork $upstream --clone=false | Write-Host

# 2) 克隆 fork 到临时目录（已存在则复用）
if (-not (Test-Path $workdir)) {
    gh repo clone "nxz1026/awesome-dsh-plugin" $workdir | Out-Null
}
Set-Location $workdir

# 3) 新建/切换投稿分支，同步上游 main
git fetch origin main 2>$null
git checkout $branch 2>$null; if (-not $?) { git checkout -B $branch origin/main }

# 4) 放入投稿 YAML 并重新生成 README
Copy-Item "$PSScriptRoot\data\plugins\nxz1026__SinglePlayer.yml" "data\plugins\nxz1026__SinglePlayer.yml" -Force
npm ci
node scripts/generate-readme.mjs

# 5) 提交并推送
git add data/plugins/nxz1026__SinglePlayer.yml README.md README.zh.md
git commit -m 'add nxz1026/SinglePlayer' 
git push -u origin $branch

# 6) 打开 PR 创建页面（等本仓库创建满 1 天后再点）
Start-Process "https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/compare/main...nxz1026:$branch"
Write-Host '分支已推送。确认本仓库创建满 1 天后，在浏览器里点击 Create pull request 即可。'
