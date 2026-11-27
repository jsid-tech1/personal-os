@echo off
REM NVIDIA NIM - DeepSeek V4.1 Flash
REM Host port 8001 is used because Personal OS (server.mjs) already owns 8000.
REM Override with:  set NIM_PORT=9000
if "%NIM_PORT%"=="" set NIM_PORT=8001

set LOCAL_NIM_CACHE=%USERPROFILE%\cache\nim
if not exist "%LOCAL_NIM_CACHE%" mkdir "%LOCAL_NIM_CACHE%"
icacls "%LOCAL_NIM_CACHE%" /grant "%USERNAME%:(OI)(CI)F" >nul

docker run -it --rm ^
    --gpus all ^
    --shm-size=16GB ^
    -v "%LOCAL_NIM_CACHE%:/opt/nim/.cache" ^
    -p %NIM_PORT%:8000 ^
    nvcr.io/nim/deepseek-ai/deepseek-v4.1-flash:latest
