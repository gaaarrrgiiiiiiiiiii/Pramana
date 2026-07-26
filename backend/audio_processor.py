import os
import io
import tempfile
import base64
import httpx
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import speech_recognition as sr
from gtts import gTTS
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()
router = APIRouter()

api_key = os.getenv("GEMINI_API_KEY")
gemini_client = genai.Client(api_key=api_key) if api_key else None

def transcribe_audio_with_gemini(audio_path: str, mime_type: str = "audio/wav") -> str | None:
    """
    Uses Gemini 2.5 Flash Multimodal STT for ultra-high accuracy transcription
    of Karnataka Police law enforcement jargon, officer names, stations, and Kannada/English speech.
    """
    if not gemini_client:
        return None
    try:
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()

        prompt = """
        You are an expert Speech-to-Text AI for Karnataka Police law enforcement.
        Transcribe the spoken audio with maximum domain precision.
        The audio may be spoken in Kannada, English, or mixed Kanglish.

        Recognize police vocabulary accurately:
        - Stations: Adugodi, Kalasipalya, Gokak Town, Banashankari, Rajagopal Nagar, K.R. Puram, H.A.L., Basavanagudi, Girinagar, Subramanyapura, Byatarayanapura.
        - Officer Names & Designations: CHANDRAKALA M B, IO, Inspector, PSI, DGP, SCRB.
        - Crime Categories: CYBER CRIME, ARMS ACT 1959, THEFT, MURDER, RAPE, ASSAULT, BURGLARY, ROBBERY, NARCOTICS.
        - Terms: FIR, Case, District, Hotspot, Network.

        Rules:
        - Output ONLY the clean transcribed text query.
        - Do NOT include quotation marks, markdown, or commentary.
        """
        
        response = gemini_client.models.generate_content(
            model='models/gemini-2.5-flash',
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                prompt
            ]
        )
        return response.text.strip() if response and response.text else None
    except Exception as e:
        print(f"Gemini audio STT error: {e}")
        return None

def normalize_police_jargon(text: str) -> str:
    """
    Auto-corrects common phonetic speech recognition mistakes into authoritative police domain terminology.
    """
    import re
    norm = text
    replacements = [
        (r"\b(fir|f\.i\.r\.|eff i ar|ef i ar)\b", "FIR"),
        (r"\b(arms act|arm act|arm's act|arm act 1959)\b", "ARMS ACT 1959"),
        (r"\b(cyber crime|cybercrime|cyber climb)\b", "CYBER CRIME"),
        (r"\b(adugodi|a 2 go d|adugodi ps)\b", "Adugodi PS"),
        (r"\b(kalasipalya|kalasi palya)\b", "Kalasipalya PS"),
        (r"\b(banashankari|bana sankari)\b", "Banashankari PS"),
        (r"\b(chandrakala|chandra kala|officer chandrakala)\b", "CHANDRAKALA M B"),
        (r"\b(gokak|go kak)\b", "Gokak Town PS"),
        (r"\b(kr puram|k r puram|k\.r\. puram)\b", "K.R. Puram PS"),
        (r"\b(hal ps|h a l ps|h\.a\.l\. ps)\b", "H.A.L. PS"),
        (r"\b(bengaluru|bangalore)\b", "Bengaluru City"),
        (r"\b(mysuru|mysore)\b", "Mysuru"),
        (r"\b(belagavi|belgaum)\b", "Belagavi"),
        (r"\b(hubballi|hubli)\b", "Hubballi-Dharwad"),
    ]
    for pattern, replacement in replacements:
        norm = re.sub(pattern, replacement, norm, flags=re.IGNORECASE)
    return norm

@router.post("/voice-query")
async def process_voice_query(
    audio: UploadFile = File(...),
    role: str = Form("Field Officer")
):
    """
    Accepts an audio file, transcribes with Gemini 2.5 Flash Multimodal STT (or fallback to Google SR),
    normalizes law enforcement terms, processes through Agent Pipeline, and returns TTS audio.
    """
    try:
        # Determine file extension/suffix
        filename = audio.filename or "recording.wav"
        suffix = ".wav" if filename.endswith(".wav") else ".webm" if filename.endswith(".webm") else ".mp3" if filename.endswith(".mp3") else ".wav"
        mime_type = "audio/webm" if suffix == ".webm" else "audio/mp3" if suffix == ".mp3" else "audio/wav"

        # 1. Save uploaded audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_audio:
            temp_audio.write(await audio.read())
            temp_path = temp_audio.name

        transcribed_text = None

        # 2. Try Gemini 2.5 Flash Multimodal Speech-to-Text
        try:
            transcribed_text = transcribe_audio_with_gemini(temp_path, mime_type=mime_type)
        except Exception as e:
            print(f"Gemini audio STT failed: {e}")

        # 3. Fallback to SpeechRecognition if Gemini STT wasn't available
        if not transcribed_text:
            try:
                recognizer = sr.Recognizer()
                with sr.AudioFile(temp_path) as source:
                    audio_data = recognizer.record(source)
                try:
                    transcribed_text = recognizer.recognize_google(audio_data, language="kn-IN")
                except sr.UnknownValueError:
                    transcribed_text = recognizer.recognize_google(audio_data, language="en-IN")
            except Exception as e:
                print(f"SpeechRecognition fallback error: {e}")

        if not transcribed_text:
            raise HTTPException(status_code=400, detail="Could not comprehend audio. Please speak clearly into the microphone.")

        # Normalize domain terms
        transcribed_text = normalize_police_jargon(transcribed_text)

        # 4. Auth & Agent Pipeline
        from auth import create_access_token

        role_id_map = {
            "SCRB Analyst": 1,
            "Inspector": 2,
            "Field Officer": 4,
            "DGP": 1
        }
        user_id = role_id_map.get(role, 4)

        token_payload = {
            "sub": f"voice_{role.lower().replace(' ', '_')}",
            "id": user_id,
            "full_name": f"Voice User {role}",
            "role": role,
            "badge_number": f"BADGE_VOICE_{role.upper().replace(' ', '_')}",
            "district": "Bengaluru"
        }
        token = create_access_token(token_payload)
        headers = {"Authorization": f"Bearer {token}"}

        # Pass to Agent Pipeline
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(
                "http://127.0.0.1:8000/api/query",
                json={"query": transcribed_text},
                headers=headers
            )
            if res.status_code != 200:
                raise HTTPException(status_code=res.status_code, detail=res.text)
            query_response = res.json()

        # 5. Generate TTS via gTTS
        kannada_answer = query_response.get("answer_kannada", "")
        if not kannada_answer:
            kannada_answer = "ಪ್ರಶ್ನೆಯನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಸಂಸ್ಕರಿಸಲಾಗಿದೆ."

        audio_base64 = ""
        try:
            tts = gTTS(text=kannada_answer[:200], lang='kn')
            tts_fp = io.BytesIO()
            tts.write_to_fp(tts_fp)
            tts_fp.seek(0)
            audio_base64 = base64.b64encode(tts_fp.read()).decode('utf-8')
        except Exception as e:
            print(f"gTTS error: {e}")

        return {
            "transcription": transcribed_text,
            "response": query_response,
            "audio_base64": audio_base64
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
