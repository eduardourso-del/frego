package com.bearlabs.frego_pdv

import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.security.MessageDigest

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
                    "clientIdentity" ->
                        result.success(
                            mapOf(
                                "packageName" to packageName,
                                "certSha1" to signingCertSha1(),
                            ),
                        )
                    else -> result.notImplemented()
                }
            }
    }

    @Suppress("DEPRECATION")
    private fun signingCertSha1(): String {
        return try {
            val signatures =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    val info =
                        packageManager.getPackageInfo(
                            packageName,
                            PackageManager.GET_SIGNING_CERTIFICATES,
                        )
                    info.signingInfo?.apkContentsSigners
                } else {
                    val info =
                        packageManager.getPackageInfo(
                            packageName,
                            PackageManager.GET_SIGNATURES,
                        )
                    info.signatures
                }
            val signature = signatures?.firstOrNull() ?: return ""
            val digest = MessageDigest.getInstance("SHA-1").digest(signature.toByteArray())
            buildString(digest.size * 2) {
                for (byte in digest) {
                    append("%02x".format(byte.toInt() and 0xff))
                }
            }
        } catch (_: Exception) {
            ""
        }
    }

    private companion object {
        const val channel = "com.bearlabs.frego_pdv/terminal"
    }
}
