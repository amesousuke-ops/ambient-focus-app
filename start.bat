@echo off
echo Starting Ambient Focus Studio Web Server...
start "" "http://localhost:8080"
python -m http.server 8080
