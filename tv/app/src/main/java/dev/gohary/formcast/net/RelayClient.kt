package dev.gohary.formcast.net

import dev.gohary.formcast.data.ExerciseMsg
import dev.gohary.formcast.data.PoseMsg
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

/**
 * WebSocket client to the FormCast relay. The TV joins `/tv?room=CODE`; the phone camera page joins
 * `/phone?room=CODE`. Reconnects with backoff; exposes the latest pose and connection state as flows.
 */
class RelayClient(private val baseUrl: String, val room: String) {
    private val json = Json { ignoreUnknownKeys = true }
    private val http = OkHttpClient.Builder().pingInterval(20, TimeUnit.SECONDS).build()
    private var ws: WebSocket? = null
    private var closed = false
    private var backoffMs = 1000L

    val connected = MutableStateFlow(false)
    val phones = MutableStateFlow(0)
    val pose: MutableStateFlow<PoseMsg?> = MutableStateFlow(null)
    val lastError = MutableStateFlow<String?>(null)
    /** Incremented whenever a phone says hello (joined or reconnected) so the TV can resend the current exercise. */
    val hello = MutableStateFlow(0)

    val state: StateFlow<Boolean> get() = connected

    fun connect() {
        closed = false
        open()
    }

    private fun open() {
        val url = "$baseUrl/tv?room=$room"
        val req = Request.Builder().url(url).build()
        ws = http.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                connected.value = true
                lastError.value = null
                backoffMs = 1000
            }
            override fun onMessage(webSocket: WebSocket, text: String) {
                runCatching { json.decodeFromString(PoseMsg.serializer(), text) }.onSuccess { m ->
                    when (m.t) {
                        "pose" -> pose.value = m
                        "peers" -> phones.value = m.phones ?: 0
                        "hello" -> hello.value = hello.value + 1
                    }
                }
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                connected.value = false
                lastError.value = t.message ?: "connection failed"
                scheduleReconnect()
            }
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                connected.value = false
                scheduleReconnect()
            }
        })
    }

    private fun scheduleReconnect() {
        if (closed) return
        val delay = backoffMs
        backoffMs = (backoffMs * 2).coerceAtMost(10_000)
        Thread {
            Thread.sleep(delay)
            if (!closed) open()
        }.start()
    }

    fun sendExercise(id: String, name: String) {
        ws?.send(json.encodeToString(ExerciseMsg.serializer(), ExerciseMsg(id = id, name = name)))
    }

    fun close() {
        closed = true
        ws?.close(1000, "bye")
        ws = null
        connected.value = false
    }

    companion object {
        private const val ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        fun newRoomCode(): String = (1..4).map { ALPHABET.random() }.joinToString("")
    }
}
