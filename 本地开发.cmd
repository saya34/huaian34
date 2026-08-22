@echo off
chcp 65001 >nul
setlocal
set "NODE_EXE=C:\Users\12056\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
cd /d "%~dp0"

if not exist "%NODE_EXE%" (
  echo [错误] 未找到 Codex 自带的 Node.js。
  pause
  exit /b 1
)

echo 开发服务启动：http://localhost:3000
echo 关闭本窗口或按 Ctrl+C 即可停止服务。
start "" cmd /c "timeout /t 3 >nul & start "" http://localhost:3000"
"%NODE_EXE%" node_modules\vinext\dist\cli.js dev -H 0.0.0.0 -p 3000

