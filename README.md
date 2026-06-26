# ScubaScubaa

Webcam-powered OpenCV/MediaPipe experiment: hold one hand near your nose and wave the other hand side to side to trigger GATO MODE, which plays `gato.mp4` with `audio.mp3`.

## Requirements

- Python 3
- Webcam access
- macOS for audio playback via `afplay`

Install Python dependencies:

```bash
pip install opencv-python mediapipe
```

## Run

Keep `gato.mp4` and `audio.mp3` in the project folder, then run:

```bash
python3 scubacat_final.py
```

Press `q` to quit.
