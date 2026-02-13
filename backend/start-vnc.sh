#!/bin/bash

DISPLAY_NUM=${DISPLAY_NUM:-99}
VNC_PORT=${VNC_PORT:-5900}
WS_PORT=${WS_PORT:-6080}
RESOLUTION=${RESOLUTION:-1920x1080x24}

export DISPLAY=:${DISPLAY_NUM}

pgrep -f "Xvfb :${DISPLAY_NUM}" > /dev/null && exit 0

Xvfb :${DISPLAY_NUM} -screen 0 ${RESOLUTION} -ac +extension RANDR &
x11vnc -display :${DISPLAY_NUM} -forever -shared -nopw -listen 0.0.0.0 -rfbport ${VNC_PORT} -bg
websockify 0.0.0.0:${WS_PORT} 127.0.0.1:${VNC_PORT} &
