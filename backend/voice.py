import os

CONFIRMATION_WORDS = {"yes", "confirm", "agree", "affirmative", "yeah", "yep"}
TIMEOUT = int(os.environ.get("CONFIRMATION_TIMEOUT", 5))
SKIP_VOICE = os.environ.get("SKIP_VOICE", "false").lower() == "true"

_client = None
VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID")


def _get_client():
    """Lazily build the ElevenLabs client so the app still boots without a key."""
    global _client
    if _client is None:
        from elevenlabs.client import ElevenLabs

        _client = ElevenLabs(api_key=os.environ.get("ELEVENLABS_API_KEY"))
    return _client


def speak(text: str):
    print(f"[Voice] Speaking: {text!r}")
    if SKIP_VOICE or not os.environ.get("ELEVENLABS_API_KEY"):
        print("[Voice] (TTS skipped — no key or SKIP_VOICE set)")
        return
    try:
        from elevenlabs import play

        audio = _get_client().generate(
            text=text,
            voice=VOICE_ID,
            model="eleven_monolingual_v1",
        )
        play(audio)
    except Exception as e:  # noqa: BLE001
        print(f"[Voice] TTS error: {e}")


def listen_for_confirmation() -> bool:
    if SKIP_VOICE:
        print("[Voice] SKIP_VOICE set — auto-confirming")
        return True

    try:
        import speech_recognition as sr
    except Exception as e:  # noqa: BLE001
        print(f"[Voice] speech_recognition unavailable ({e}) — auto-confirming")
        return True

    recognizer = sr.Recognizer()
    try:
        with sr.Microphone() as source:
            recognizer.adjust_for_ambient_noise(source, duration=0.5)
            print("[Voice] Listening for confirmation...")
            audio = recognizer.listen(source, timeout=TIMEOUT, phrase_time_limit=4)
        text = recognizer.recognize_google(audio).lower()
        print(f"[Voice] Heard: {text}")
        return any(word in text for word in CONFIRMATION_WORDS)
    except sr.WaitTimeoutError:
        print("[Voice] Timeout — no confirmation received")
        return False
    except sr.UnknownValueError:
        print("[Voice] Could not understand audio")
        return False
    except Exception as e:  # noqa: BLE001 — mic/driver issues shouldn't crash the demo
        print(f"[Voice] Recognition error: {e}")
        return False
