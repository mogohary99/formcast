package dev.gohary.formcast.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.store: DataStore<Preferences> by preferencesDataStore(name = "formcast_progress")

/**
 * Per-profile adaptive targets. Simple and transparent: hit the target → next target +10%;
 * miss by a lot → -10%; otherwise hold. Persisted on the device so the TV remembers each household member.
 */
class Progress(private val context: Context) {
    private fun key(profile: String, ex: Exercise) = intPreferencesKey("target.$profile.${ex.id}")
    private fun sessions(profile: String) = intPreferencesKey("sessions.$profile")
    private fun last(profile: String) = stringPreferencesKey("last.$profile")

    suspend fun target(profile: String, ex: Exercise): Int = context.store.data.first()[key(profile, ex)] ?: ex.baseTarget
    suspend fun sessionCount(profile: String): Int = context.store.data.first()[sessions(profile)] ?: 0
    suspend fun lastSummary(profile: String): String? = context.store.data.first()[last(profile)]

    /** Returns the new target. */
    suspend fun record(profile: String, r: SetResult): Int {
        val next = when {
            r.reps >= r.target -> (r.target * 1.1 + 0.5).toInt().coerceAtLeast(r.target + 1)
            r.reps < r.target * 0.6 -> (r.target * 0.9).toInt().coerceAtLeast(3)
            else -> r.target
        }
        context.store.edit { it[key(profile, r.exercise)] = next }
        return next
    }

    suspend fun finishSession(profile: String, results: List<SetResult>) {
        context.store.edit {
            it[sessions(profile)] = (it[sessions(profile)] ?: 0) + 1
            it[last(profile)] = results.joinToString(" · ") { r -> "${r.exercise.label} ${r.reps}/${r.target}" }
        }
    }
}
