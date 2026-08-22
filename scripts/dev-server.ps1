# 单身汉（DSH）播放器 —— dsh web 开发服务启停脚本
# 用法：
#   powershell -File scripts\dev-server.ps1           # 启动（已在跑则跳过）
#   powershell -File scripts\dev-server.ps1 -Stop     # 停止
# 注意：服务运行于一个最小化的「dsh-web」控制台窗口，关闭该窗口 = 停止服务。

param([switch]$Stop)

$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$repo    = 'E:\2026Workplace\Code\DSH_music_Huazai'
$harness = 'E:\2026Workplace\Code\deepseek-harness'
$log     = "$env:TEMP\dsh-web-out.log"

function Get-ServerProcess {
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
        Where-Object { $_.CommandLine -like '*bin.ts web*' } |
        Select-Object -First 1
}

if ($Stop) {
    $proc = Get-ServerProcess
    if ($proc) {
        Stop-Process -Id $proc.ProcessId -Force
        Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" |
            Where-Object { $_.CommandLine -like '*dsh-web*' } |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
        Write-Host "已停止 dsh web (PID $($proc.ProcessId))"
    } else {
        Write-Host 'dsh web 未在运行'
    }
    exit 0
}

$existing = Get-ServerProcess
if ($existing) {
    Write-Host "dsh web 已在运行 (PID $($existing.ProcessId))，http://127.0.0.1:3080"
    exit 0
}

Remove-Item $log -ErrorAction SilentlyContinue
Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c', 'start "dsh-web" /min cmd /c "node --import tsx/esm apps/cli/src/bin.ts web --port 3080 --no-open > %TEMP%\dsh-web-out.log 2>&1"' `
    -WorkingDirectory $harness `
    -WindowStyle Minimized

$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
    if (Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue) {
        Start-Sleep -Seconds 3
        try {
            $health = Invoke-WebRequest -Uri 'http://127.0.0.1:3080/api/dsh-music/health' -UseBasicParsing -TimeoutSec 10
            Write-Host "dsh web 已启动：http://127.0.0.1:3080"
            Write-Host "播放器插件：$($health.Content)"
            Write-Host '提示：最小化的「dsh-web」窗口是服务本体，关闭即停服；用本脚本可随时重启。'
            exit 0
        } catch { }
    }
    Start-Sleep -Seconds 4
}
Write-Host '启动超时，日志尾部：'
Get-Content $log -Tail 20
exit 1
