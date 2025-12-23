#!/bin/bash
# build-and-push.sh

# 设置变量（请修改为您的用户名）
DOCKER_USERNAME="qzcxh"
IMAGE_NAME="wan-animate-app"
VERSION="1.0.0"

# 构建镜像
echo "构建镜像..."
docker build -t ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION} .
docker tag ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION} ${DOCKER_USERNAME}/${IMAGE_NAME}:latest

# 推送镜像
echo "推送镜像..."
docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}
docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:latest

echo "完成！"
echo "镜像地址: ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
