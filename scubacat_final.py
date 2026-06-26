import cv2
import mediapipe as mp
import math
import os
import subprocess
import time
from collections import deque


CAT_VIDEO = "gato.mp4"
AUDIO_FILE = "audio.mp3"

HOLD_NOSE_DISTANCE = 200
WAVE_DISTANCE = 55
SIDEWAYS_RATIO = 0.8
WAVE_HISTORY_FRAMES = 12
STOP_DELAY_SECONDS = 1 / 3


mp_hands = mp.solutions.hands
mp_face_mesh = mp.solutions.face_mesh
mp_draw = mp.solutions.drawing_utils


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def open_cat_video():
    if not os.path.exists(CAT_VIDEO):
        print("Missing gato.mp4 in the same folder.")
        return None

    video = cv2.VideoCapture(CAT_VIDEO)
    if not video.isOpened():
        print("Could not open gato.mp4.")
        return None

    return video


def show_next_cat_frame(video):
    success, frame = video.read()
    if not success:
        video.set(cv2.CAP_PROP_POS_FRAMES, 0)
        success, frame = video.read()

    if success:
        cv2.imshow("GATO MODE", frame)


def start_audio():
    if not os.path.exists(AUDIO_FILE):
        print("Missing audio.mp3 in the same folder.")
        return None

    return subprocess.Popen(
        ["afplay", AUDIO_FILE],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )


def stop_audio(audio_process):
    if audio_process is None or audio_process.poll() is not None:
        return

    audio_process.terminate()
    try:
        audio_process.wait(timeout=0.5)
    except subprocess.TimeoutExpired:
        audio_process.kill()


def main():
    cam = cv2.VideoCapture(0)

    if not cam.isOpened():
        print("Could not open webcam.")
        return

    wave_history = deque(maxlen=WAVE_HISTORY_FRAMES)
    last_dance_time = None
    cat_video = None
    audio_process = None

    with mp_hands.Hands(
        max_num_hands=2,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    ) as hands, mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=False,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    ) as face_mesh:

        while True:
            success, frame = cam.read()
            if not success:
                break

            frame = cv2.flip(frame, 1)
            height, width, _ = frame.shape

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            hand_results = hands.process(rgb)
            face_results = face_mesh.process(rgb)

            nose_zone = None
            if face_results.multi_face_landmarks:
                nose = face_results.multi_face_landmarks[0].landmark[1]
                nose_zone = (int(nose.x * width), int(nose.y * height))

            hand_infos = []

            if hand_results.multi_hand_landmarks:
                for hand in hand_results.multi_hand_landmarks:
                    mp_draw.draw_landmarks(
                        frame,
                        hand,
                        mp_hands.HAND_CONNECTIONS,
                        mp_draw.DrawingSpec(color=(0, 0, 255), thickness=2, circle_radius=4),
                        mp_draw.DrawingSpec(color=(255, 255, 255), thickness=2)
                    )

                    landmarks = hand.landmark
                    landmark_points = [
                        (int(landmark.x * width), int(landmark.y * height))
                        for landmark in landmarks
                    ]

                    wrist = (
                        int(landmarks[0].x * width),
                        int(landmarks[0].y * height)
                    )

                    index_tip = (
                        int(landmarks[8].x * width),
                        int(landmarks[8].y * height)
                    )

                    middle_tip = (
                        int(landmarks[12].x * width),
                        int(landmarks[12].y * height)
                    )

                    palm_center = (
                        (wrist[0] + index_tip[0] + middle_tip[0]) // 3,
                        (wrist[1] + index_tip[1] + middle_tip[1]) // 3
                    )

                    closest_to_nose = None
                    if nose_zone is not None:
                        closest_to_nose = min(
                            dist(point, nose_zone)
                            for point in landmark_points
                        )

                    hand_infos.append({
                        "palm": palm_center,
                        "closest_to_nose": closest_to_nose,
                    })

            hand_infos = [
                hand_info
                for hand_info in hand_infos
                if hand_info["closest_to_nose"] is not None
            ]
            hand_infos.sort(key=lambda hand_info: hand_info["closest_to_nose"])
            has_nose_hand = (
                len(hand_infos) >= 2
                and hand_infos[0]["closest_to_nose"] < HOLD_NOSE_DISTANCE
            )

            if has_nose_hand:
                wave_point = hand_infos[-1]["palm"]
                wave_history.append(wave_point)

                if len(wave_history) >= 4:
                    x_positions = [point[0] for point in wave_history]
                    y_positions = [point[1] for point in wave_history]
                    x_range = max(x_positions) - min(x_positions)
                    y_range = max(y_positions) - min(y_positions)
                    is_sideways_wave = (
                        x_range > WAVE_DISTANCE
                        and x_range > y_range * SIDEWAYS_RATIO
                    )

                    if is_sideways_wave:
                        last_dance_time = time.time()
            else:
                wave_history.clear()

            dance_is_recent = (
                last_dance_time is not None
                and time.time() - last_dance_time <= STOP_DELAY_SECONDS
            )

            if dance_is_recent:
                if cat_video is None:
                    cat_video = open_cat_video()
                    audio_process = start_audio()
                if cat_video is not None:
                    show_next_cat_frame(cat_video)
            elif cat_video is not None:
                cat_video.release()
                cat_video = None
                stop_audio(audio_process)
                audio_process = None
                cv2.destroyWindow("GATO MODE")

            cv2.imshow("ScubaCat", frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    if cat_video is not None:
        cat_video.release()

    stop_audio(audio_process)
    cam.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
