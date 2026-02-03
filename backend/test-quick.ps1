# MC Server Manager 快速功能测试脚本 (Windows)
# 用法: .\test-quick.ps1

Write-Host "`n╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║ MC Server Manager 快速测试脚本       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# 检查依赖
try {
    $nodeVersion = node -v
    Write-Host "✓ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ 未找到 Node.js，请先安装 Node.js 18+" -ForegroundColor Red
    exit 1
}

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

# 检查配置
Write-Host "检查服务器配置..."
try {
    $configs = Invoke-WebRequest -Uri "http://localhost:3001/api/configs" -UseBasicParsing -ErrorAction Stop
    $configCount = ($configs.Content | Select-String -Pattern '"id"' -AllMatches).Matches.Count
    
    if ($configCount -eq 0) {
        Write-Host "❌ 未找到服务器配置" -ForegroundColor Red
        Write-Host "请先添加服务器配置" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✓ 找到 $configCount 个服务器配置" -ForegroundColor Green
} catch {
    Write-Host "❌ 获取配置失败: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "选择要运行的测试:" -ForegroundColor Cyan
Write-Host "1) 运行所有测试 (推荐)"
Write-Host "2) 运行连接测试 (步骤 54)"
Write-Host "3) 运行控制台测试 (步骤 55)"
Write-Host "4) 运行仪表盘测试 (步骤 56)"
Write-Host ""

$choice = Read-Host "请选择 (1-4)"

Write-Host ""

switch ($choice) {
    "1" {
        Write-Host "运行完整的功能测试套件..." -ForegroundColor Yellow
        npm run test:functional
        $testResult = $LASTEXITCODE
    }
    "2" {
        Write-Host "运行连接测试..." -ForegroundColor Yellow
        npm run test:connection
        $testResult = $LASTEXITCODE
    }
    "3" {
        Write-Host "运行控制台测试..." -ForegroundColor Yellow
        npm run test:console
        $testResult = $LASTEXITCODE
    }
    "4" {
        Write-Host "运行仪表盘测试..." -ForegroundColor Yellow
        npm run test:dashboard
        $testResult = $LASTEXITCODE
    }
    default {
        Write-Host "❌ 无效的选择" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
if ($testResult -eq 0) {
    Write-Host "✅ 测试完成" -ForegroundColor Green
} else {
    Write-Host "❌ 测试失败" -ForegroundColor Red
}

exit $testResult
