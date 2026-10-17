package com.bearlabs.frego_pdv

import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        TerminalBridge.bind(this)
    }

    override fun onDestroy() {
        TerminalBridge.unbind(this)
        super.onDestroy()
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "serialNumber" -> result.success(TerminalBridge.serialNumber())
                    else -> result.notImplemented()
                }
            }
    }

    private companion object {
        const val channel = "com.bearlabs.frego_pdv/terminal"
    }
}
