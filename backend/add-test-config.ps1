# MC Server Manager 配置添加脚本
# 用法: .\add-test-config.ps1

Write-Host "`n╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║ MC Server Manager 配置添加工具       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# 检查后端是否运行
Write-Host "检查后端服务..."
try {
    $health = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -ErrorAction Stop
    Write-Host "✓ 后端服务正在运行" -ForegroundColor Green
} catch {
    Write-Host "❌ 后端服务未运行" -ForegroundColor Red
    Write-Host "请先运行: npm run dev" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "请输入以下信息来配置 Minecraft 服务器:" -ForegroundColor Yellow
Write-Host ""

# 获取用户输入
$name = Read-Host "服务器名称 (例如: 主世界服务器)"
if ([string]::IsNullOrWhiteSpace($name)) {
    $name = "默认服务器"
}

$host = Read-Host "服务器地址 (例如: 127.0.0.1 或服务器IP)"
if ([string]::IsNullOrWhiteSpace($host)) {
    $host = "127.0.0.1"
}

$port = Read-Host "RCON 端口 (例如: 25575)"
if ([string]::IsNullOrWhiteSpace($port)) {
    $port = 25575
}

$password = Read-Host "RCON 密码" -AsSecureString
$passwordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($password)
)

if ([string]::IsNullOrWhiteSpace($passwordPlain)) {
    Write-Host "❌ 密码不能为空" -ForegroundColor Red
    exit 1
}

$timeout = Read-Host "连接超时 (毫秒，例如: 5000)"
if ([string]::IsNullOrWhiteSpace($timeout)) {
    $timeout = 5000
}

$sparkUrl = Read-Host "Spark API URL (可选，例如: http://127.0.0.1:8080)"
if ([string]::IsNullOrWhiteSpace($sparkUrl)) {
    $sparkUrl = ""
}

Write-Host ""
Write-Host "正在添加配置..." -ForegroundColor Yellow

# 构建请求体
$body = @{
    name = $name
    host = $host
    port = [int]$port
    password = $passwordPlain
    timeout = [int]$timeout
} | ConvertTo-Json

if (![string]::IsNullOrWhiteSpace($sparkUrl)) {
    $body = @{
        name = $name
        host = $host
        port = [int]$port
        password = $passwordPlain
        timeout = [int]$timeout
        sparkApiUrl = $sparkUrl
    } | ConvertTo-Json
}

# 发送请求
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/configs" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body `
        -UseBasicParsing -ErrorAction Stop

    $result = $response.Content | ConvertFrom-Json
    
    if ($result.success) {
        Write-Host "✓ 配置添加成功！" -ForegroundColor Green
        Write-Host ""
        Write-Host "配置信息:" -ForegroundColor Cyan
        Write-Host "  服务器名称: $name"
        Write-Host "  地址: $host"
        Write-Host "  RCON 端口: $port"
        Write-Host "  超时: ${timeout}ms"
        
        if (![string]::IsNullOrWhiteSpace($sparkUrl)) {
            Write-Host "  Spark API: $sparkUrl"
        }
        
        Write-Host ""
        Write-Host "现在可以运行测试了:" -ForegroundColor Green
        Write-Host "  npm run test:functional" -ForegroundColor Yellow
    } else {
        Write-Host "❌ 配置添加失败: $($result.error.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ 请求失败: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
