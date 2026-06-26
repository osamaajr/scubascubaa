# ScubaScubaa

Chrome extension webcam experiment: hold one hand near your nose and wave the other hand side to side to trigger GATO MODE, which plays `gato.mp4` with `audio.mp3`.

## Use The Extension

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. Click the ScubaScubaa extension icon.
6. Allow camera access in the side panel, then do the gesture.

The camera opens in Chrome's side panel, so it stays in the same browser window without creating a new tab. When the gesture is detected, GATO MODE opens in a small separate Chrome window and plays the video without cropping. If no gesture is detected after 7 seconds, the side panel shows a hint.

The extension runs fully from local files. The MediaPipe browser runtime and models are vendored in `vendor/`.

## Files

- `manifest.json` defines the Chrome extension.
- `background.js` opens the side-panel facecam.
- `extension/app.html` is the camera app.
- `extension/app.js` contains the browser gesture detector.
- `gato.mp4` and `audio.mp3` are used for GATO MODE.
- `scubacat_final.py` is the original Python prototype.

## Python Prototype

To run the original script instead:

```bash
pip install opencv-python mediapipe
python3 scubacat_final.py
```
