# Arrow Drive

A small, dependency-free browser driving game. Allow camera access, then hold a bright green left- or right-pointing arrow horizontally in view. The car follows the real arrow into the next lane; avoid traffic to keep driving and increase your distance. Left/right arrow keys (or A and D) are available as a keyboard fallback.

## Run

Camera access requires localhost or HTTPS. For a local web server, run `npx vite --host 127.0.0.1` from this folder if Vite is installed, then visit the address it prints.

Press Start Driving and allow camera access to steer with the real arrow. If the camera is unavailable, continue with keyboard steering instead. Press Enter or Space to start or restart. Steering keys work while a drive is in progress.

## Test arrow recognition

Run `node --test arrow-detection.test.js` from this folder to test left/right green-arrow detection and rejection of a plain green rectangle.
