# Motion Arcade

A body-powered mini game arcade built with React, TypeScript, and Vite. Connect a camera for pose controls or play with the keyboard.

## Run locally

```sh
npm install
npm run dev
```

## Desktop shortcut

Build the production app, then open the **Motion Arcade** shortcut on the Windows desktop:

```sh
npm run build
```

The shortcut uses the pixel dinosaur icon, starts the production preview on `127.0.0.1:4174` when needed, and opens the game in Microsoft Edge or Google Chrome app mode. Keep the project dependencies installed so the launcher can start its local server.

Windows also runs a per-user **Motion Arcade Shortcut Recovery** task at sign-in and every 15 minutes. It repairs the desktop and Start Menu shortcuts if they are removed or their logo/launcher settings change. Recovery errors are logged to `%LOCALAPPDATA%\Motion Arcade\shortcut-recovery.log`.

Camera access requires a secure context. The launcher's loopback address is treated as secure by supported browsers.
