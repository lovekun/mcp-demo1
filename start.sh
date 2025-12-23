#!/usr/bin/env bash
# 切到脚本所在目录
cd "$(dirname "$0")"

# 设置 PYTHONPATH 指向 src，并启动服务
export PYTHONPATH="$PWD/src"
python -m mcp_weather_server --mode sse --host 0.0.0.0 --port 3000