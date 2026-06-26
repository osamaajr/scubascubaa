# ScubaScubaa

Chrome extension webcam experiment: hold one hand near your nose and wave the other hand side to side to trigger GATO MODE, which plays `gato.mp4` with `audio.mp3`.

## Use The Extension

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. Open a normal webpage.
6. Click the ScubaScubaa extension icon.
7. Allow camera access in the floating overlay, then do the gesture.

The camera opens as a simple Photo Booth-style overlay on the current page. When the gesture is detected, GATO MODE opens as a second overlay on the same page and plays the video without cropping. If no gesture is detected after 7 seconds, the camera overlay shows a hint.

The extension runs fully from local files. The MediaPipe browser runtime and models are vendored in `vendor/`.

## Files

- `manifest.json` defines the Chrome extension.
- `background.js` injects the overlay into the current tab.
- `content.js` creates the camera and GATO overlays.
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
