@echo off
REM Smoke-test the local NIM endpoint.
REM Usage: nim_curl.cmd  ["your prompt here"]
if "%NIM_PORT%"=="" set NIM_PORT=8001
if "%~1"=="" (
  set PROMPT=Hello! How are you?
) else (
  set PROMPT=%~1
)

echo Waiting for NIM to become ready on port %NIM_PORT%...
curl.exe -sS --retry 30 --retry-delay 2 --retry-connrefused -o NUL -w "health: HTTP %%{http_code}\n" "http://127.0.0.1:%NIM_PORT%/v1/models"

echo.
echo Listing models:
curl.exe -sS "http://127.0.0.1:%NIM_PORT%/v1/models"
echo.
echo.
echo Chat completion:
curl.exe -sS -X POST "http://127.0.0.1:%NIM_PORT%/v1/chat/completions" ^
  -H "accept: application/json" ^
  -H "Content-Type: application/json" ^
  -d "{\"model\":\"deepseek-ai/deepseek-v4.1-flash\",\"messages\":[{\"role\":\"user\",\"content\":\"%PROMPT%\"}],\"max_tokens\":64}"
echo.
