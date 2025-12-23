#!/bin/bash
# deploy.sh - 部署脚本

set -e

echo "=========================================="
echo "    图生动作 Docker 部署脚本"
echo "=========================================="

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "错误: Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查 docker-compose 是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "错误: docker-compose 未安装，请先安装 docker-compose"
    exit 1
fi

# 检查环境变量
if [ -z "$DASHSCOPE_API_KEY" ]; then
    echo "警告: DASHSCOPE_API_KEY 环境变量未设置"
    read -p "请输入您的 API Key: " api_key
    export DASHSCOPE_API_KEY=$api_key
    
    # 写入 .env 文件
    echo "DASHSCOPE_API_KEY=$api_key" > .env
    echo "已保存到 .env 文件"
fi

# 创建数据目录
echo "创建数据目录..."
mkdir -p data/uploads data/downloads

# 构建镜像
echo "构建 Docker 镜像..."
docker-compose build

# 启动服务
echo "启动服务..."
docker-compose up -d

# 等待服务启动
echo "等待服务启动..."
sleep 5

# 检查服务状态
if docker-compose ps | grep -q "Up"; then
    echo "=========================================="
    echo "部署成功!"
    echo "访问地址: http://localhost:5000"
    echo "=========================================="
    echo ""
    echo "常用命令:"
    echo "  查看日志: docker-compose logs -f"
    echo "  停止服务: docker-compose down"
    echo "  重启服务: docker-compose restart"
else
    echo "启动失败，请检查日志:"
    docker-compose logs
    exit 1
fi
