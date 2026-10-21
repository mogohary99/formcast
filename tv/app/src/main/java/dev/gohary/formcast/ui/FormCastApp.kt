package dev.gohary.formcast.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.Button
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import androidx.tv.material3.darkColorScheme
import dev.gohary.formcast.data.PROGRAMS
import dev.gohary.formcast.data.Program

private val Bg = Color(0xFF0B1016)
private val Panel = Color(0xFF121922)
private val Panel2 = Color(0xFF1A2330)
private val Accent = Color(0xFF35C2FF)
private val Ok = Color(0xFF4FC38A)
private val Warn = Color(0xFFF5B84F)
private val Muted = Color(0xFF93A0B2)

@Composable
fun FormCastApp(vm: SessionViewModel = viewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    MaterialTheme(colorScheme = darkColorScheme(primary = Accent, surface = Bg, background = Bg, onSurface = Color.White)) {
        Surface(Modifier.fillMaxSize(), colors = androidx.tv.material3.SurfaceDefaults.colors(containerColor = Bg)) {
            BackHandler(enabled = s.screen != Screen.HOME) { vm.back() }
            when (s.screen) {
                Screen.HOME -> HomeScreen(s, vm)
                Screen.PAIR -> PairScreen(s, vm)
                Screen.SESSION -> SessionScreen(s, vm)
                Screen.SUMMARY -> SummaryScreen(s, vm)
            }
        }
    }
}

@Composable
private fun TopBar(title: String, right: String? = null) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 48.dp, vertical = 28.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(14.dp).clip(CircleShape).background(Accent))
        Spacer(Modifier.width(12.dp))
        Text("FormCast", fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.width(18.dp))
        Text(title, fontSize = 18.sp, color = Muted)
        Spacer(Modifier.weight(1f))
        if (right != null) Text(right, fontSize = 16.sp, color = Muted)
    }
}

@Composable
private fun HomeScreen(s: UiState, vm: SessionViewModel) {
    val first = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { first.requestFocus() } }
    Column(Modifier.fillMaxSize()) {
        TopBar("Your phone is the camera. Your TV is the coach.", "${s.profile} · ${s.sessionsBefore} sessions")
        Text("Who's training?", Modifier.padding(horizontal = 48.dp), fontSize = 16.sp, color = Muted)
        Row(Modifier.padding(horizontal = 40.dp, vertical = 8.dp)) {
            s.profiles.forEachIndexed { i, p ->
                val selected = p == s.profile
                Button(onClick = { vm.selectProfile(p) }, modifier = Modifier.padding(8.dp).then(if (i == 0) Modifier.focusRequester(first) else Modifier)) {
                    Text(if (selected) "● $p" else p, fontSize = 16.sp)
                }
            }
        }
        if (s.lastSummary != null) Text("Last time: ${s.lastSummary}", Modifier.padding(horizontal = 48.dp), fontSize = 15.sp, color = Muted)
        Spacer(Modifier.height(18.dp))
        Text("Programs", Modifier.padding(horizontal = 48.dp), fontSize = 16.sp, color = Muted)
        LazyRow(contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 40.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            items(PROGRAMS) { p -> ProgramCard(p) { vm.openProgram(p) } }
        }
        Spacer(Modifier.weight(1f))
        Text(
            "Targets adapt to each person: hit a target and the next one goes up 10%. Press ▶ on a program, then scan the code with your phone.",
            Modifier.padding(horizontal = 48.dp, vertical = 24.dp), fontSize = 14.sp, color = Muted,
        )
    }
}

@Composable
private fun ProgramCard(p: Program, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.width(300.dp).height(200.dp), colors = CardDefaults.colors(containerColor = Panel, focusedContainerColor = Panel2)) {
        Column(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(p.accent).copy(alpha = 0.35f), Color.Transparent))).padding(20.dp)) {
            Text(p.title, fontSize = 24.sp, fontWeight = FontWeight.Bold)
            Text(p.subtitle, fontSize = 15.sp, color = Muted)
            Spacer(Modifier.weight(1f))
            Text("${p.minutes} min · ${p.exercises.size} sets", fontSize = 14.sp, color = Color(p.accent))
            Text(p.exercises.joinToString(" · ") { it.label }, fontSize = 13.sp, color = Muted)
        }
    }
}

@Composable
private fun PairScreen(s: UiState, vm: SessionViewModel) {
    val url = "${s.camUrl}?room=${s.room}"
    val bmp = remember(url) { qrBitmap(url) }
    val startFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { startFocus.requestFocus() } }
    Column(Modifier.fillMaxSize()) {
        TopBar(s.program?.title ?: "", "Room ${s.room}")
        Row(Modifier.fillMaxWidth().padding(horizontal = 48.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Pair your phone", fontSize = 40.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(10.dp))
                Text("Scan the code, or open the camera page and type the room code. Video never leaves your phone; only pose landmarks reach the TV.", fontSize = 18.sp, color = Muted)
                Spacer(Modifier.height(18.dp))
                Text("Room code", fontSize = 14.sp, color = Muted)
                Text(s.room, fontSize = 64.sp, fontWeight = FontWeight.Black, color = Accent, letterSpacing = 8.sp)
                Spacer(Modifier.height(14.dp))
                StatusLine(if (s.relayConnected) "Relay connected" else (s.relayError?.let { "Relay: $it" } ?: "Connecting to relay…"), if (s.relayConnected) Ok else Warn)
                StatusLine(if (s.phoneConnected) "Phone camera connected" else "Waiting for phone…", if (s.phoneConnected) Ok else Muted)
                Spacer(Modifier.height(24.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Button(onClick = { vm.startSession(simulated = false) }, modifier = Modifier.focusRequester(startFocus)) { Text(if (s.phoneConnected) "Start workout" else "Start (waiting for phone)", fontSize = 18.sp) }
                    Button(onClick = { vm.startSession(simulated = true) }) { Text("Try without camera", fontSize = 18.sp) }
                }
                Spacer(Modifier.height(10.dp))
                Text("“Try without camera” runs the same session with synthesized reps, for TVs without a paired phone.", fontSize = 13.sp, color = Muted)
            }
            Spacer(Modifier.width(40.dp))
            Box(Modifier.size(320.dp).clip(RoundedCornerShape(20.dp)).background(Color.White).padding(14.dp)) {
                Image(bmp.asImageBitmap(), contentDescription = "QR code to open the phone camera page", Modifier.fillMaxSize())
            }
        }
    }
}

@Composable
private fun StatusLine(text: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 4.dp)) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(10.dp))
        Text(text, fontSize = 16.sp, color = Color.White)
    }
}

@Composable
private fun SessionScreen(s: UiState, vm: SessionViewModel) {
    val program = s.program ?: return
    val ex = program.exercises[s.exerciseIndex]
    val skip = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { skip.requestFocus() } }
    Row(Modifier.fillMaxSize().padding(40.dp)) {
        // Left: coaching panel
        Column(Modifier.weight(1.1f).fillMaxHeight()) {
            Text("${program.title} · set ${s.exerciseIndex + 1} of ${program.exercises.size}", fontSize = 16.sp, color = Muted)
            Text(ex.label, fontSize = 44.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(20.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Text("${s.reps}", fontSize = 140.sp, fontWeight = FontWeight.Black, color = if (s.reps >= s.target) Ok else Color.White, lineHeight = 140.sp)
                Spacer(Modifier.width(16.dp))
                Column(Modifier.padding(bottom = 26.dp)) {
                    Text("of ${s.target}", fontSize = 28.sp, color = Muted)
                    Text("target for ${s.profile}", fontSize = 14.sp, color = Muted)
                    Spacer(Modifier.height(10.dp))
                    FormChip(s.form, s.avgForm)
                }
            }
            // progress bar
            Box(Modifier.fillMaxWidth(0.9f).height(10.dp).clip(RoundedCornerShape(99.dp)).background(Panel2)) {
                Box(Modifier.fillMaxWidth((s.reps.toFloat() / s.target.coerceAtLeast(1)).coerceIn(0f, 1f)).fillMaxHeight().background(if (s.reps >= s.target) Ok else Accent))
            }
            Spacer(Modifier.height(22.dp))
            Box(Modifier.fillMaxWidth(0.9f).clip(RoundedCornerShape(16.dp)).background(Panel).padding(18.dp)) {
                Column {
                    Text(if (s.resting) "REST" else "FORM CUE", fontSize = 12.sp, color = Muted, letterSpacing = 2.sp)
                    Text(s.cue.ifBlank { ex.cueHint }, fontSize = 26.sp, fontWeight = FontWeight.SemiBold, color = if (s.cue.startsWith("Good") || s.cue.startsWith("Target")) Ok else if (s.cue.startsWith("Push") || s.cue.startsWith("Keep") || s.cue.startsWith("Go")) Warn else Color.White)
                }
            }
            Spacer(Modifier.weight(1f))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("${s.secondsLeft}s", fontSize = 22.sp, color = Muted)
                Spacer(Modifier.width(18.dp))
                Button(onClick = { vm.skipSet() }, modifier = Modifier.focusRequester(skip)) { Text(if (s.resting) "Next" else "Finish set", fontSize = 16.sp) }
                Spacer(Modifier.width(12.dp))
                Button(onClick = { vm.goHome() }) { Text("End", fontSize = 16.sp) }
            }
        }
        Spacer(Modifier.width(24.dp))
        // Right: live skeleton mirror from the phone
        Box(Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(20.dp)).background(Panel)) {
            SkeletonMirror(s.keypoints, s.phase)
            Row(Modifier.align(Alignment.TopStart).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(10.dp).clip(CircleShape).background(if (s.phoneConnected) Ok else if (s.simulated) Warn else Muted))
                Spacer(Modifier.width(8.dp))
                Text(if (s.phoneConnected) "Live from your phone" else if (s.simulated) "Demo mode · no camera" else "Waiting for phone", fontSize = 14.sp, color = Muted)
            }
            if (s.keypoints == null) Text(if (s.simulated) "Pair a phone to see yourself here" else "Step into frame", Modifier.align(Alignment.Center), color = Muted, fontSize = 18.sp)
            if (s.calibrating && s.keypoints != null) CalibrationOverlay(s.calib, Modifier.align(Alignment.BottomCenter))
        }
    }
}

/** Last-rep form score and running average, colour-coded. Hidden until the first rep. */
@Composable
private fun FormChip(form: Int?, avg: Int?) {
    if (form == null) return
    val color = if (form >= 70) Ok else Warn
    Row(Modifier.clip(RoundedCornerShape(99.dp)).background(color.copy(alpha = 0.18f)).padding(horizontal = 12.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("FORM", fontSize = 11.sp, color = color, letterSpacing = 2.sp)
        Spacer(Modifier.width(8.dp))
        Text("$form", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = color)
        if (avg != null) Text("  avg $avg", fontSize = 13.sp, color = Muted)
    }
}

/** Shown while the phone learns the person's standing pose (about one second). */
@Composable
private fun CalibrationOverlay(progress: Float, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth().padding(18.dp)) {
        Text("Hold still — learning your standing pose", fontSize = 16.sp, color = Warn)
        Spacer(Modifier.height(8.dp))
        Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(99.dp)).background(Panel2)) {
            Box(Modifier.fillMaxWidth(progress.coerceIn(0f, 1f)).fillMaxHeight().background(Warn))
        }
    }
}

/** Draws the 13-joint skeleton from normalized keypoints, mirrored like a real mirror. */
@Composable
private fun SkeletonMirror(kp: List<List<Float>>?, phase: String) {
    // kp order: nose, Lsh, Rsh, Lel, Rel, Lwr, Rwr, Lhip, Rhip, Lknee, Rknee, Lank, Rank
    val edges = listOf(1 to 2, 1 to 3, 3 to 5, 2 to 4, 4 to 6, 1 to 7, 2 to 8, 7 to 8, 7 to 9, 9 to 11, 8 to 10, 10 to 12)
    Canvas(Modifier.fillMaxSize().padding(24.dp)) {
        if (kp == null) return@Canvas
        val w = size.width; val h = size.height
        fun pt(i: Int) = Offset((1f - kp[i][0]) * w, kp[i][1] * h)
        val color = if (phase == "down") Warn else Accent
        for ((a, b) in edges) if (kp[a][2] > 0.4f && kp[b][2] > 0.4f) drawLine(color, pt(a), pt(b), strokeWidth = 10f, cap = StrokeCap.Round)
        for (i in kp.indices) if (kp[i][2] > 0.4f) drawCircle(Color.White, radius = if (i == 0) 16f else 10f, center = pt(i))
    }
}

@Composable
private fun SummaryScreen(s: UiState, vm: SessionViewModel) {
    val home = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { home.requestFocus() } }
    Column(Modifier.fillMaxSize()) {
        TopBar("Session complete", s.profile)
        Column(Modifier.padding(horizontal = 48.dp)) {
            Text("Nice work, ${s.profile}.", fontSize = 40.sp, fontWeight = FontWeight.Bold)
            Text("Here's how the next session adapts.", fontSize = 18.sp, color = Muted)
            Spacer(Modifier.height(20.dp))
            s.setResults.forEach { r ->
                val next = s.nextTargets[r.exercise] ?: r.target
                Row(Modifier.fillMaxWidth(0.8f).padding(vertical = 6.dp).clip(RoundedCornerShape(14.dp)).background(Panel).padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(r.exercise.label, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
                        Text("${r.reps} of ${r.target} reps in ${r.seconds}s" + (r.avgForm?.let { " · form $it%" } ?: ""), fontSize = 15.sp, color = Muted)
                    }
                    Text(if (next > r.target) "Next: $next ↑" else if (next < r.target) "Next: $next ↓" else "Next: $next →", fontSize = 20.sp, color = if (next > r.target) Ok else if (next < r.target) Warn else Muted, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(24.dp))
            Button(onClick = { vm.goHome() }, modifier = Modifier.focusRequester(home)) { Text("Back to programs", fontSize = 18.sp) }
        }
    }
}
