package dev.gohary.formcast

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import dev.gohary.formcast.ui.FormCastApp
import dev.gohary.formcast.ui.SessionViewModel

class MainActivity : ComponentActivity() {
    private val vm: SessionViewModel by viewModels()
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Debug/testing hook: `adb shell am start -n dev.gohary.formcast/.MainActivity --es room DEMO`
        // pins the pairing room so a scripted phone can join. Real users always get a random code.
        intent?.getStringExtra("room")?.let { vm.overrideRoom(it) }
        setContent { FormCastApp(vm) }
    }
}
