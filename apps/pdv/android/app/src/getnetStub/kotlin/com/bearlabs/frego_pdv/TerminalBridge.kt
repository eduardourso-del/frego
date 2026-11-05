package com.bearlabs.frego_pdv

import android.content.Context

/**
 * Stand-in used when the Getnet hardware SDK is not in android/app/libs.
 * Release builds refuse to assemble without that AAR.
 */
internal object TerminalBridge {
    fun bind(context: Context) {}

    fun unbind(context: Context) {}

    fun serialNumber(): String? = null
}
