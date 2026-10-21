package dev.gohary.formcast.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import dev.gohary.formcast.BuildConfig
import dev.gohary.formcast.data.Exercise
import dev.gohary.formcast.data.PoseMsg
import dev.gohary.formcast.data.Program
import dev.gohary.formcast.data.Progress
import dev.gohary.formcast.data.SetResult
import dev.gohary.formcast.net.RelayClient
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class Screen { HOME, PAIR, SESSION, SUMMARY }

data class UiState(
    val screen: Screen = Screen.HOME,
    val profile: String = "Mo",
    val profiles: List<String> = listOf("Mo", "Sara", "Guest"),
    val program: Program? = null,
    val room: String = RelayClient.newRoomCode(),
    val camUrl: String = BuildConfig.CAM_URL,
    val relayUrl: String = BuildConfig.RELAY_URL,
    val relayConnected: Boolean = false,
    val phoneConnected: Boolean = false,
    val relayError: String? = null,
    // session
    val exerciseIndex: Int = 0,
    val target: Int = 0,
    val reps: Int = 0,
    val phase: String = "",
    val cue: String = "",
    val keypoints: List<List<Float>>? = null,
    val secondsLeft: Int = 0,
    val setResults: List<SetResult> = emptyList(),
    val resting: Boolean = false,
    val sessionsBefore: Int = 0,
    val lastSummary: String? = null,
    val nextTargets: Map<Exercise, Int> = emptyMap(),
    /** Demo mode when no phone is paired: synthesized reps so the TV flow can be shown on an emulator. */
    val simulated: Boolean = false,
)

class SessionViewModel(app: Application) : AndroidViewModel(app) {
    private val progress = Progress(app)
    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()
    private var relay: RelayClient? = null
    private var timer: Job? = null
    private var simJob: Job? = null

    init {
        viewModelScope.launch { refreshProfileStats() }
    }

    private suspend fun refreshProfileStats() {
        val p = _state.value.profile
        _state.update { it.copy(sessionsBefore = progress.sessionCount(p), lastSummary = progress.lastSummary(p)) }
    }

    fun selectProfile(name: String) {
        _state.update { it.copy(profile = name) }
        viewModelScope.launch { refreshProfileStats() }
    }

    fun openProgram(program: Program) {
        _state.update { it.copy(program = program, screen = Screen.PAIR) }
        ensureRelay()
    }

    private fun ensureRelay() {
        if (relay != null) return
        val r = RelayClient(_state.value.relayUrl, _state.value.room)
        relay = r
        r.connect()
        viewModelScope.launch { r.connected.collectLatest { c -> _state.update { it.copy(relayConnected = c) } } }
        viewModelScope.launch { r.lastError.collectLatest { e -> _state.update { it.copy(relayError = e) } } }
        viewModelScope.launch { r.phones.collectLatest { n -> _state.update { it.copy(phoneConnected = n > 0) } } }
        viewModelScope.launch { r.pose.collectLatest { p -> p?.let(::onPose) } }
    }

    private fun onPose(p: PoseMsg) {
        val s = _state.value
        if (s.screen != Screen.SESSION || s.resting) return
        val ex = s.program?.exercises?.getOrNull(s.exerciseIndex) ?: return
        if (p.ex != ex.id) return
        _state.update { it.copy(reps = p.reps, phase = p.phase ?: "", cue = p.cue ?: "", keypoints = p.kp) }
        if (p.reps >= s.target) completeSet()
    }

    fun startSession(simulated: Boolean) {
        val s = _state.value
        val program = s.program ?: return
        _state.update { it.copy(screen = Screen.SESSION, exerciseIndex = 0, setResults = emptyList(), simulated = simulated) }
        beginExercise(0)
    }

    private fun beginExercise(index: Int) {
        val s = _state.value
        val program = s.program ?: return
        val ex = program.exercises[index]
        viewModelScope.launch {
            val target = progress.target(s.profile, ex)
            _state.update { it.copy(exerciseIndex = index, target = target, reps = 0, phase = "", cue = ex.cueHint, keypoints = null, secondsLeft = 60, resting = false) }
            relay?.sendExercise(ex.id, ex.label)
            startTimer()
            if (_state.value.simulated) startSimulation(ex, target)
        }
    }

    private fun startTimer() {
        timer?.cancel()
        timer = viewModelScope.launch {
            while (_state.value.secondsLeft > 0 && _state.value.screen == Screen.SESSION && !_state.value.resting) {
                delay(1000)
                _state.update { it.copy(secondsLeft = it.secondsLeft - 1) }
            }
            if (_state.value.screen == Screen.SESSION && !_state.value.resting && _state.value.secondsLeft <= 0) completeSet()
        }
    }

    /** Emulator/demo path: no camera. Reps tick at a realistic cadence so the flow is demonstrable. */
    private fun startSimulation(ex: Exercise, target: Int) {
        simJob?.cancel()
        simJob = viewModelScope.launch {
            var reps = 0
            while (reps < target && _state.value.screen == Screen.SESSION && !_state.value.resting) {
                delay(if (ex == Exercise.JUMPING_JACK) 900 else 1800)
                reps++
                val cue = when {
                    reps == 1 -> "Good rep"
                    reps == target / 2 && ex == Exercise.SQUAT -> "Push knees out"
                    reps == target - 1 -> "Last one, full range"
                    else -> ex.cueHint
                }
                _state.update { it.copy(reps = reps, cue = cue, phase = "up") }
                if (reps >= target) completeSet()
            }
        }
    }

    private fun completeSet() {
        val s = _state.value
        if (s.resting) return
        val program = s.program ?: return
        val ex = program.exercises[s.exerciseIndex]
        val result = SetResult(ex, s.target, s.reps, 60 - s.secondsLeft)
        timer?.cancel(); simJob?.cancel()
        _state.update { it.copy(resting = true, setResults = it.setResults + result, cue = if (s.reps >= s.target) "Target hit!" else "Set done") }
        viewModelScope.launch {
            val next = progress.record(s.profile, result)
            _state.update { it.copy(nextTargets = it.nextTargets + (ex to next)) }
            delay(3500)
            val nextIndex = s.exerciseIndex + 1
            if (nextIndex < program.exercises.size) beginExercise(nextIndex) else finish()
        }
    }

    fun skipSet() = completeSet()

    private fun finish() {
        val s = _state.value
        viewModelScope.launch {
            progress.finishSession(s.profile, s.setResults)
            refreshProfileStats()
            _state.update { it.copy(screen = Screen.SUMMARY, resting = false) }
        }
    }

    fun goHome() {
        timer?.cancel(); simJob?.cancel()
        _state.update { it.copy(screen = Screen.HOME, program = null, resting = false) }
    }

    fun back() {
        when (_state.value.screen) {
            Screen.PAIR -> goHome()
            Screen.SESSION -> goHome()
            Screen.SUMMARY -> goHome()
            Screen.HOME -> {}
        }
    }

    override fun onCleared() {
        relay?.close()
        super.onCleared()
    }
}
