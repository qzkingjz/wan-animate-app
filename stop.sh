#!/bin/bash
# stop.sh - 停止脚本

echo "停止服务..."
docker-compose down
echo "服务已停止"
