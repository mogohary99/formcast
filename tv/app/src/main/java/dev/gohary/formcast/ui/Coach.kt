package dev.gohary.formcast.ui

import android.content.Context
import android.speech.tts.TextToSpeech
import android.util.Log
import java.util.Locale
import java.util.concurrent.Executors

/**
 * Spoken coaching on the TV: voice + D-pad + visual in one flow. Uses the platform text-to-speech engine
 * (present on Fire OS and on the Android TV emulator); stays silent if no engine is available.
 *
 * Every engine call runs on a single background thread: binding the engine and `setLanguage` can block for
 * seconds while the engine loads voice data, which caused an ANR on the emulator when done on the main thread.
 * Cues are rate-limited so the TV does not nag: at most one utterance per 2.5 s, and the same cue is not
 * repeated within 8 s.
 */
class Coach(context: Context) {
    private val app = context.applicationContext
    private val worker = Executors.newSingleThreadExecutor { r -> Thread(r, "formcast-coach").apply { isDaemon = true } }
    @Volatile private var ready = false
    @Volatile var enabled = true
    private var tts: TextToSpeech? = null
    private var lastText = ""
    private var lastAt = 0L
    private var lastAnyAt = 0L

    init {
        worker.execute {
            runCatching {
                var engine: TextToSpeech? = null
                engine = TextToSpeech(app) { status ->
                    worker.execute {
                        if (status == TextToSpeech.SUCCESS) {
                            runCatching { engine?.language = Locale.US; engine?.setSpeechRate(1.05f) }
                            ready = true
                            Log.i(TAG, "TTS ready")
                        } else Log.i(TAG, "TTS unavailable (status $status)")
                    }
                }
                tts = engine
            }.onFailure { Log.w(TAG, "TTS init failed: ${it.message}") }
        }
    }

    /** Speak [text] unless muted, not ready, or rate-limited. [force] bypasses the rate limit (set/session events). */
    fun say(text: String, force: Boolean = false) {
        if (!enabled || text.isBlank()) return
        worker.execute {
            val engine = tts ?: return@execute
            if (!ready) return@execute
            val now = System.currentTimeMillis()
            if (!force && ((text == lastText && now - lastAt < 8_000) || now - lastAnyAt < 2_500)) return@execute
            lastText = text; lastAt = now; lastAnyAt = now
            Log.i(TAG, "speak: $text")
            runCatching { engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "cue-$now") }.onFailure { Log.w(TAG, "speak failed: ${it.message}") }
        }
    }

    fun shutdown() {
        worker.execute { runCatching { tts?.shutdown() }; tts = null; ready = false }
        worker.shutdown()
    }

    companion object {
        const val TAG = "FormCastCoach"
        /** Cues worth saying out loud (actionable or milestone); transient phase labels are not spoken. */
        val SPOKEN = setOf(
            "Push knees out", "Keep hips in line", "Go a little deeper", "Elbows to 90°", "Front knee to 90°",
            "Feet wider", "Hands overhead", "Reach higher", "Last one, full range",
            "Step back: show hips to ankles", "Show shoulders, elbows and wrists", "Step back: show shoulders to ankles",
        )
    }
}
