package com.bearlabs.frego_pdv

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.RemoteException
import com.getnet.posdigital.PosDigital
import com.getnet.posdigital.info.IInfoCallback
import com.getnet.posdigital.info.InfoResponse

/**
 * Binds the Getnet hardware SDK on the main thread and reads the serial
 * printed on the terminal sticker. Get Store rejects an app that uses
 * Android's own serial instead.
 *
 * Compiled only when libposdigital is in android/app/libs.
 */
internal object TerminalBridge {
    private const val maxAttempts = 3

    private val main = Handler(Looper.getMainLooper())

    @Volatile
    private var serial: String? = null

    private var attempt = 0
    private var stopped = false

    fun bind(context: Context) {
        val app = context.applicationContext
        stopped = false
        attempt = 0
        serial = null
        connect(app)
    }

    fun unbind(context: Context) {
        stopped = true
        main.removeCallbacksAndMessages(null)
        val app = context.applicationContext
        try {
            if (PosDigital.getInstance().isInitiated) {
                PosDigital.unregister(app)
            }
        } catch (_: Exception) {
        }
    }

    fun serialNumber(): String? = serial?.takeIf { it.isNotBlank() }

    private fun connect(app: Context) {
        if (stopped || attempt >= maxAttempts) return
        attempt += 1
        try {
            PosDigital.register(
                app,
                object : PosDigital.BindCallback {
                    override fun onError(error: Exception) {
                        try {
                            if (PosDigital.getInstance().isInitiated) {
                                PosDigital.unregister(app)
                            }
                        } catch (_: Exception) {
                        }
                        scheduleRetry(app)
                    }

                    override fun onConnected() {
                        attempt = 0
                        readSerial()
                    }

                    override fun onDisconnected() {
                        scheduleRetry(app)
                    }
                },
            )
        } catch (_: Exception) {
            scheduleRetry(app)
        }
    }

    private fun scheduleRetry(app: Context) {
        if (stopped || attempt >= maxAttempts) return
        main.post { connect(app) }
    }

    private fun readSerial() {
        try {
            if (!PosDigital.getInstance().isInitiated) return
            PosDigital.getInstance().getInfo().info(
                object : IInfoCallback.Stub() {
                    @Throws(RemoteException::class)
                    override fun onInfo(infoResponse: InfoResponse) {
                        val value = infoResponse.getSerialNumber()?.trim().orEmpty()
                        if (value.isNotEmpty()) serial = value
                    }

                    @Throws(RemoteException::class)
                    override fun onError(message: String) {
                    }
                },
            )
        } catch (_: Exception) {
        }
    }
}
