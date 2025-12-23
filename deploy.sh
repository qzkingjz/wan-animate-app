#!/bin/bash
# deploy.sh - 部署脚本

set -e

echo "=========================================="
echo "    图生动作 - Docker 部署脚本"
echo "=========================================="

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "错误: 请先安装 Docker"
    exit 1
fi

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "未找到 .env 文件，开始配置..."
    echo ""
    
    # API Key
    read -p "请输入阿里云百炼 API Key: " api_key
    echo "DASHSCOPE_API_KEY=$api_key" > .env
    
    # OSS 配置
    echo ""
    read -p "是否配置 OSS？(强烈建议，否则无法直接上传文件) [y/N]: " config_oss
    
    if [[ "$config_oss" =~ ^[Yy]$ ]]; then
        read -p "OSS AccessKey ID: " oss_key_id
        read -p "OSS AccessKey Secret: " oss_key_secret
        read -p "OSS Bucket 名称: " oss_bucket
        read -p "OSS Endpoint [oss-cn-shanghai.aliyuncs.com]: " oss_endpoint
        oss_endpoint=${oss_endpoint:-oss-cn-shanghai.aliyuncs.com}
        
        echo "OSS_ACCESS_KEY_ID=$oss_key_id" >> .env
        echo "OSS_ACCESS_KEY_SECRET=$oss_key_secret" >> .env
        echo "OSS_BUCKET_NAME=$oss_bucket" >> .env
        echo "OSS_ENDPOINT=$oss_endpoint" >> .env
    fi
    
    echo ""
    echo "配置已保存到 .env 文件"
fi

# 创建目录
mkdir -p data/uploads data/downloads

# 构建并启动
echo ""
echo "构建并启动服务..."
docker-compose up -d --build

# 等待启动
sleep 5

# 检查状态
if docker-compose ps | grep -q "Up"; then
    echo ""
    echo "=========================================="
    echo "✅ 部署成功!"
    echo ""
    echo "访问地址: http://localhost:5000"
    IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "your-server-ip")
    echo "         http://${IP}:5000"
    echo ""
    echo "查看日志: docker-compose logs -f"
    echo "=========================================="
else
    echo "❌ 启动失败"
    docker-compose logs
    exit 1
fi
