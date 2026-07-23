import os
import io
import tempfile
import base64
import httpx
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import speech_recognition as sr
from gtts import gTTS

router = APIRouter()

@router.post("/voice-query")
async def process_voice_query(
    audio: UploadFile = File(...),
    role: str = Form("Field Officer")
):
    """
    Accepts an audio file, runs Speech-to-Text (SpeechRecognition),
    processes the query through the Agent Pipeline, and returns the result
    along with a TTS audio response (gTTS).
    """
    try:
        # 1. Save uploaded audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
            temp_audio.write(await audio.read())
            temp_path = temp_audio.name
            
        # 2. STT via SpeechRecognition (Google Free API)
        recognizer = sr.Recognizer()
        with sr.AudioFile(temp_path) as source:
            audio_data = recognizer.record(source)
        
        # Try recognizing in Kannada, fallback to English
        try:
            transcribed_text = recognizer.recognize_google(audio_data, language="kn-IN")
        except sr.UnknownValueError:
            try:
                transcribed_text = recognizer.recognize_google(audio_data, language="en-IN")
            except sr.UnknownValueError:
                raise HTTPException(status_code=400, detail="Could not understand audio.")
                
        # 3. Pass to Agent Pipeline via local HTTP call
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(
                "http://127.0.0.1:8000/api/query",
                json={"query": transcribed_text, "role": role}
            )
            if res.status_code != 200:
                raise HTTPException(status_code=res.status_code, detail=res.text)
            query_response = res.json()
        
        # 4. Generate TTS via gTTS
        kannada_answer = query_response.get("answer_kannada", "")
        if not kannada_answer:
            kannada_answer = "ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ."
            
        tts = gTTS(text=kannada_answer, lang='kn')
        tts_fp = io.BytesIO()
        tts.write_to_fp(tts_fp)
        tts_fp.seek(0)
        
        audio_base64 = base64.b64encode(tts_fp.read()).decode('utf-8')
        
        return {
            "transcription": transcribed_text,
            "response": query_response,
            "audio_base64": audio_base64
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
