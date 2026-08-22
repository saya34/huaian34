@echo off
chcp 65001 >nul
setlocal
set "NODE_EXE=C:\Users\12056\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
cd /d "%~dp0"

if not exist "%NODE_EXE%" (
  echo [错误] 未找到 Codex 自带的 Node.js：
  echo %NODE_EXE%
  echo 请安装 Node.js 22.13 或更高版本后再运行。
  pause
  exit /b 1
)

echo [1/2] 正在构建《槐安一梦》...
"%NODE_EXE%" node_modules\vinext\dist\cli.js build
if errorlevel 1 (
  echo [错误] 构建失败，请保留本窗口中的报错信息。
  pause
  exit /b 1
)

echo [2/2] 本地服务启动：http://localhost:3000
echo 手机访问请使用：http://电脑IPv4地址:3000
echo 关闭本窗口或按 Ctrl+C 即可停止服务。
start "" cmd /c "timeout /t 3 >nul & start "" http://localhost:3000"
"%NODE_EXE%" node_modules\vinext\dist\cli.js start -H 0.0.0.0 -p 3000

