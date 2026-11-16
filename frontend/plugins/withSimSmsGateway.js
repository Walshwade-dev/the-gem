const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require('expo/config-plugins');

const KOTLIN_MODULE_TEMPLATE = (pkg) => `package ${pkg}

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.telephony.SmsManager
import android.telephony.SubscriptionManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

class SmsGatewayModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val ACTION_SMS_SENT = "${pkg}.SMS_GATEWAY_SENT"
        private const val EXTRA_MSG_ID = "msg_id"
        private const val SEND_TIMEOUT_MS = 30_000L
    }

    private data class PendingSms(
        val promise: Promise,
        val remainingParts: AtomicInteger,
        val timeoutRunnable: Runnable,
    )

    private val pending = ConcurrentHashMap<String, PendingSms>()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var receiverRegistered = false

    private val sentReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val msgId = intent?.getStringExtra(EXTRA_MSG_ID) ?: return
            val entry = pending[msgId] ?: return

            if (resultCode != Activity.RESULT_OK) {
                if (pending.remove(msgId) != null) {
                    mainHandler.removeCallbacks(entry.timeoutRunnable)
                    val errCode = intent.getIntExtra("errorCode", -1)
                    entry.promise.reject("SMS_SEND_ERROR", decodeError(resultCode, errCode))
                }
                return
            }

            if (entry.remainingParts.decrementAndGet() <= 0) {
                if (pending.remove(msgId) != null) {
                    mainHandler.removeCallbacks(entry.timeoutRunnable)
                    entry.promise.resolve(true)
                }
            }
        }
    }

    override fun getName(): String = "SmsGatewayModule"

    @Synchronized
    private fun ensureReceiverRegistered() {
        if (receiverRegistered) return
        val filter = IntentFilter(ACTION_SMS_SENT)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(sentReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            reactContext.registerReceiver(sentReceiver, filter)
        }
        receiverRegistered = true
    }

    override fun invalidate() {
        if (receiverRegistered) {
            try {
                reactContext.unregisterReceiver(sentReceiver)
            } catch (_: IllegalArgumentException) {
            }
            receiverRegistered = false
        }
        pending.clear()
        super.invalidate()
    }

    @SuppressLint("MissingPermission")
    @ReactMethod
    fun getActiveSims(promise: Promise) {
        try {
            val result = Arguments.createArray()
            val hasPhonePerm = reactContext.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) ==
                PackageManager.PERMISSION_GRANTED
            if (!hasPhonePerm) {
                promise.resolve(result)
                return
            }
            val defaultSubId = SubscriptionManager.getDefaultSmsSubscriptionId()
            val subMgr = reactContext.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
            val list = subMgr?.activeSubscriptionInfoList ?: emptyList()
            val hasPhoneNumPerm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                reactContext.checkSelfPermission(Manifest.permission.READ_PHONE_NUMBERS) ==
                    PackageManager.PERMISSION_GRANTED
            } else {
                true
            }
            for (info in list.sortedBy { it.simSlotIndex }) {
                val map = Arguments.createMap()
                map.putInt("subscriptionId", info.subscriptionId)
                map.putInt("slotIndex", info.simSlotIndex)
                map.putString("carrierName", info.carrierName?.toString().orEmpty().ifBlank { "Carrier" })
                map.putString("displayName", info.displayName?.toString().orEmpty().ifBlank { "SIM \${info.simSlotIndex + 1}" })
                map.putBoolean("isDefaultSmsSim", info.subscriptionId == defaultSubId)
                val simNumber = try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && hasPhoneNumPerm) {
                        subMgr?.getPhoneNumber(info.subscriptionId).orEmpty()
                    } else {
                        @Suppress("DEPRECATION")
                        info.number.orEmpty()
                    }
                } catch (_: Exception) {
                    ""
                }
                map.putString("phoneNumber", simNumber)
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("SIM_LIST_ERROR", e.message ?: "Failed to read SIM list", e)
        }
    }

    @SuppressLint("MissingPermission")
    private fun resolveTargetSubId(requestedSubId: Int): Int? {
        if (requestedSubId > 0) return requestedSubId
        val defaultSubId = SubscriptionManager.getDefaultSmsSubscriptionId()
        if (defaultSubId != SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
            return defaultSubId
        }
        val hasPhonePerm = reactContext.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) ==
            PackageManager.PERMISSION_GRANTED
        if (hasPhonePerm) {
            val subMgr = reactContext.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
            val firstSim = subMgr?.activeSubscriptionInfoList?.minByOrNull { it.simSlotIndex }
            if (firstSim != null) return firstSim.subscriptionId
        }
        return null
    }

    private fun getSmsManager(subId: Int?): SmsManager {
        return if (subId != null && subId != SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                reactContext.getSystemService(SmsManager::class.java)
                    ?.createForSubscriptionId(subId)
                    ?: throw IllegalStateException("SmsManager unavailable for subId=$subId")
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getSmsManagerForSubscriptionId(subId)
            }
        } else {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                reactContext.getSystemService(SmsManager::class.java)
                    ?: throw IllegalStateException("SmsManager unavailable")
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }
        }
    }

    @ReactMethod
    fun sendSms(phone: String, message: String, subscriptionId: Int, promise: Promise) {
        try {
            ensureReceiverRegistered()
            val targetSubId = resolveTargetSubId(subscriptionId)
            val smsManager = getSmsManager(targetSubId)
            val parts = smsManager.divideMessage(message)
            val msgId = UUID.randomUUID().toString()

            val timeoutRunnable = Runnable {
                if (pending.remove(msgId) != null) {
                    promise.reject("SMS_SEND_TIMEOUT", "Timed out waiting for SIM network confirmation")
                }
            }
            pending[msgId] = PendingSms(promise, AtomicInteger(parts.size), timeoutRunnable)
            mainHandler.postDelayed(timeoutRunnable, SEND_TIMEOUT_MS)

            val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            val baseReqCode = (System.currentTimeMillis() and 0x7FFFFFFFL).toInt()

            if (parts.size > 1) {
                val sentIntents = ArrayList<PendingIntent>(parts.size)
                for (i in parts.indices) {
                    sentIntents.add(
                        PendingIntent.getBroadcast(
                            reactContext,
                            baseReqCode + i,
                            Intent(ACTION_SMS_SENT).apply {
                                setPackage(reactContext.packageName)
                                putExtra(EXTRA_MSG_ID, msgId)
                            },
                            flags,
                        )
                    )
                }
                smsManager.sendMultipartTextMessage(phone, null, parts, sentIntents, null)
            } else {
                val sentIntent = PendingIntent.getBroadcast(
                    reactContext,
                    baseReqCode,
                    Intent(ACTION_SMS_SENT).apply {
                        setPackage(reactContext.packageName)
                        putExtra(EXTRA_MSG_ID, msgId)
                    },
                    flags,
                )
                smsManager.sendTextMessage(phone, null, message, sentIntent, null)
            }
        } catch (e: Exception) {
            promise.reject("SMS_SEND_ERROR", e.message ?: "Failed to send SMS via SIM", e)
        }
    }

    private fun decodeError(resultCode: Int, errCode: Int): String = when (resultCode) {
        SmsManager.RESULT_ERROR_GENERIC_FAILURE -> "SIM generic failure (errorCode=$errCode)"
        SmsManager.RESULT_ERROR_RADIO_OFF -> "Cellular radio is off / Airplane mode"
        SmsManager.RESULT_ERROR_NULL_PDU -> "Invalid SMS PDU"
        SmsManager.RESULT_ERROR_NO_SERVICE -> "No cellular service on SIM"
        SmsManager.RESULT_ERROR_LIMIT_EXCEEDED -> "Android SMS rate limit exceeded"
        SmsManager.RESULT_ERROR_SHORT_CODE_NOT_ALLOWED -> "Short code not allowed"
        SmsManager.RESULT_ERROR_SHORT_CODE_NEVER_ALLOWED -> "Short code blocked"
        else -> "SMS send failed (resultCode=$resultCode, errorCode=$errCode)"
    }
}
`;

const KOTLIN_PACKAGE_TEMPLATE = (pkg) => `package ${pkg}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SmsGatewayPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(SmsGatewayModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

function withSimSmsGateway(config) {
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    for (const perm of [
      'android.permission.SEND_SMS',
      'android.permission.READ_PHONE_STATE',
      'android.permission.READ_PHONE_NUMBERS',
    ]) {
      const exists = manifest['uses-permission'].some(
        (p) => p.$?.['android:name'] === perm
      );
      if (!exists) {
        manifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }
    return mod;
  });

  config = withDangerousMod(config, [
    'android',
    async (mod) => {
      const pkg = mod.android?.package || 'com.thegem.onionsales';
      const pkgPath = path.join(
        mod.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        ...pkg.split('.')
      );
      fs.mkdirSync(pkgPath, { recursive: true });
      fs.writeFileSync(
        path.join(pkgPath, 'SmsGatewayModule.kt'),
        KOTLIN_MODULE_TEMPLATE(pkg),
        'utf8'
      );
      fs.writeFileSync(
        path.join(pkgPath, 'SmsGatewayPackage.kt'),
        KOTLIN_PACKAGE_TEMPLATE(pkg),
        'utf8'
      );
      return mod;
    },
  ]);

  config = withMainApplication(config, (mod) => {
    let contents = mod.modResults.contents;
    if (!contents.includes('SmsGatewayPackage()')) {
      contents = contents.replace(
        /PackageList\(this\)\.packages\.apply\s*\{/,
        'PackageList(this).packages.apply {\n              add(SmsGatewayPackage())'
      );
      mod.modResults.contents = contents;
    }
    return mod;
  });

  return config;
}

module.exports = withSimSmsGateway;
