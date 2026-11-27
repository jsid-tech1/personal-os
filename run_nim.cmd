@echo off
set LOCAL_NIM_CACHE=%USERPROFILE%\cache\nim
mkdir "%LOCAL_NIM_CACHE%"
icacls "%LOCAL_NIM_CACHE%" /grant "%USERNAME%:(OI)(CI)F"
docker run -it --rm ^
    --gpus all ^
    --shm-size=16GB ^
    -v "%LOCAL_NIM_CACHE%:/opt/nim/.cache" ^
    -p 8000:8000 ^
    nvcr.io/nim/deepseek-ai/deepseek-v4.1-flash:latest