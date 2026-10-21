package dev.gohary.formcast.data

import kotlinx.serialization.Serializable

/** Exercise ids must match the counters in the phone camera page. */
enum class Exercise(val id: String, val label: String, val cueHint: String, val baseTarget: Int) {
    SQUAT("squat", "Squats", "Hips below knees, chest up", 10),
    PUSHUP("pushup", "Push-ups", "Elbows to 90°, hips in line", 8),
    LUNGE("lunge", "Lunges", "Front knee over ankle", 10),
    JUMPING_JACK("jumpingjack", "Jumping jacks", "Hands overhead, feet wide", 15);

    companion object {
        fun byId(id: String) = entries.firstOrNull { it.id == id } ?: SQUAT
    }
}

data class Program(val id: String, val title: String, val subtitle: String, val minutes: Int, val exercises: List<Exercise>, val accent: Long)

val PROGRAMS = listOf(
    Program("quick", "Quick Start", "Three moves, no equipment", 6, listOf(Exercise.SQUAT, Exercise.PUSHUP, Exercise.JUMPING_JACK), 0xFF35C2FF),
    Program("legs", "Leg Day Lite", "Squats and lunges with form checks", 8, listOf(Exercise.SQUAT, Exercise.LUNGE, Exercise.SQUAT), 0xFF4FC38A),
    Program("cardio", "Living Room Cardio", "Jumping jacks and squats, fast tempo", 7, listOf(Exercise.JUMPING_JACK, Exercise.SQUAT, Exercise.JUMPING_JACK), 0xFFF5B84F),
    Program("upper", "Push & Hold", "Push-ups with hip-line coaching", 6, listOf(Exercise.PUSHUP, Exercise.JUMPING_JACK, Exercise.PUSHUP), 0xFFFF7A7A),
)

/** Messages on the relay. Phone → TV. */
@Serializable
data class PoseMsg(
    val t: String,
    val ex: String? = null,
    val reps: Int = 0,
    val phase: String? = null,
    val cue: String? = null,
    /** 13 joints: nose, L/R shoulder, L/R elbow, L/R wrist, L/R hip, L/R knee, L/R ankle; each [x, y, visibility] normalized. */
    val kp: List<List<Float>>? = null,
    val phones: Int? = null,
    val tv: Int? = null,
    /** Form score of the last rep (0–100) and running average, from the phone's counters. */
    val form: Int? = null,
    val avg: Int? = null,
    /** Calibration progress 0–1 and whether the counter is ready. */
    val calib: Float? = null,
    val ready: Boolean? = null,
)

/** TV → phone. */
@Serializable
data class ExerciseMsg(val t: String = "exercise", val id: String, val name: String)

data class SetResult(val exercise: Exercise, val target: Int, val reps: Int, val seconds: Int, val avgForm: Int? = null)
