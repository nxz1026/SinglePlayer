# 取流诊断：搜索晴天并逐个测试 /url
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:3080/api/dsh-music'

$search = (Invoke-WebRequest -Uri "$base/search?keyword=%E6%99%B4%E5%A4%A9%20%E5%91%A8%E6%9D%B0%E4%BC%A6&limit=5" -UseBasicParsing -TimeoutSec 40).Content | ConvertFrom-Json
Write-Host "=== 搜索结果 ==="
foreach ($t in $search.tracks) {
    Write-Host ("[{0}] {1} {2} vip={3}" -f $t.provider, $t.songId, $t.name, $t.vip)
}

Write-Host "`n=== 逐个取流（quality=exhigh）==="
foreach ($t in $search.tracks) {
    try {
        $u = (Invoke-WebRequest -Uri "$base/url?id=$([uri]::EscapeDataString($t.id))&quality=exhigh" -UseBasicParsing -TimeoutSec 60).Content | ConvertFrom-Json
        if ($u.result.url) {
            Write-Host ("OK   [{0}] {1} => quality={2} trial={3}" -f $t.provider, $t.songId, $u.result.quality, $u.result.trial)
        } else {
            Write-Host ("FAIL [{0}] {1} => {2}" -f $t.provider, $t.songId, $u.result.reason)
        }
    } catch {
        Write-Host ("ERR  [{0}] {1} => {2}" -f $t.provider, $t.songId, $_.Exception.Message)
    }
}
