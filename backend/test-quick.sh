#!/bin/bash

# 快速功能测试脚本
# 用法: ./test-quick.sh

echo "╔════════════════════════════════════════╗"
echo "║ MC Server Manager 快速测试脚本       ║"
echo "╚════════════════════════════════════════╝"
echo ""

# 检查依赖
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js，请先安装 Node.js 18+"
    exit 1
fi

if ! command -v ts-node &> /dev/null; then
    echo "⚠ 未找到 ts-node，正在安装..."
    npm install -g ts-node
fi

# 检查后端是否运行
echo "检查后端服务..."
if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "❌ 后端服务未运行"
    echo "请先运行: npm run dev"
    exit 1
fi
echo "✓ 后端服务正在运行"
echo ""

# 检查配置
echo "检查服务器配置..."
CONFIG_COUNT=$(curl -s http://localhost:3001/api/configs | grep -o '"id"' | wc -l)

if [ "$CONFIG_COUNT" -eq 0 ]; then
    echo "❌ 未找到服务器配置"
    echo "请先添加服务器配置"
    exit 1
fi
echo "✓ 找到 $CONFIG_COUNT 个服务器配置"
echo ""

# 选择测试类型
echo "选择要运行的测试:"
echo "1) 运行所有测试 (推荐)"
echo "2) 运行连接测试"
echo "3) 运行控制台测试"
echo "4) 运行仪表盘测试"
echo ""
read -p "请选择 (1-4): " choice

case $choice in
    1)
        echo "运行完整的功能测试套件..."
        npm run test:functional
        ;;
    2)
        echo "运行连接测试..."
        npm run test:connection
        ;;
    3)
        echo "运行控制台测试..."
        npm run test:console
        ;;
    4)
        echo "运行仪表盘测试..."
        npm run test:dashboard
        ;;
    *)
        echo "无效的选择"
        exit 1
        ;;
esac

TEST_RESULT=$?

echo ""
if [ $TEST_RESULT -eq 0 ]; then
    echo "✅ 测试完成"
else
    echo "❌ 测试失败"
fi

exit $TEST_RESULT
