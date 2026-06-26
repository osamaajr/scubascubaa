# ScubaScubaa

Chrome extension webcam experiment: hold one hand near your nose and wave the other hand side to side to trigger GATO MODE, which plays `gato.mp4` with `audio.mp3`.

## Use The Extension

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. Pin ScubaScubaa from the puzzle-piece extensions menu if needed.
6. Click the ScubaScubaa icon.
7. Allow camera access in the dropdown, then do the gesture.

The camera opens as a compact top-right dropdown from the extension icon. When the gesture is detected, GATO MODE plays inside the same dropdown without cropping. If no gesture is detected after 7 seconds, the dropdown shows a hint.

The extension runs fully from local files. The MediaPipe browser runtime and models are vendored in `vendor/`.

## Files

- `manifest.json` defines the Chrome extension.
- `extension/app.html` is the toolbar dropdown camera app.
- `extension/app.js` contains the browser gesture detector.
- `gato.mp4` and `audio.mp3` are used for GATO MODE.
- `scubacat_final.py` is the original Python prototype.

## Python Prototype

To run the original script instead:

```bash
pip install opencv-python mediapipe
python3 scubacat_final.py
```
