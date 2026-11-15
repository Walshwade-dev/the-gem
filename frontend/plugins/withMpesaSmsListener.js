const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require('expo/config-plugins');

const KOTLIN_MODULE_TEMPLATE = (pkg) => `package ${pkg}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.provider.Telephony
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class MpesaSmsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var receiver: BroadcastReceiver? = null

    override fun getName(): String = "MpesaSmsModule"

    @ReactMethod
    fun startListening() {
        if (receiver != null) return
        val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
        filter.priority = IntentFilter.SYSTEM_HIGH_PRIORITY
        val smsReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
                val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
                val fullBody = StringBuilder()
                var sender = ""
                for (sms in messages) {
                    if (sender.isEmpty()) sender = sms.originatingAddress ?: ""
                    fullBody.append(sms.messageBody ?: "")
                }
                val bodyStr = fullBody.toString()
                if (sender.contains("MPESA", ignoreCase = true) ||
                    (bodyStr.contains("Confirmed", ignoreCase = true) &&
                        bodyStr.contains("Ksh", ignoreCase = true))
                ) {
                    val params = Arguments.createMap().apply {
                        putString("sender", sender)
                        putString("body", bodyStr)
                    }
                    if (reactContext.hasActiveReactInstance()) {
                        reactContext
                            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            .emit("onMpesaSmsReceived", params)
                    }
                }
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(smsReceiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            reactContext.registerReceiver(smsReceiver, filter)
        }
        receiver = smsReceiver
    }

    @ReactMethod
    fun stopListening() {
        receiver?.let {
            try {
                reactContext.unregisterReceiver(it)
            } catch (_: Exception) {
            }
            receiver = null
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
`;

const KOTLIN_PACKAGE_TEMPLATE = (pkg) => `package ${pkg}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class MpesaSmsPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(MpesaSmsModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

function withMpesaSmsListener(config) {
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    for (const perm of [
      'android.permission.RECEIVE_SMS',
      'android.permission.READ_SMS',
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
        path.join(pkgPath, 'MpesaSmsModule.kt'),
        KOTLIN_MODULE_TEMPLATE(pkg),
        'utf8'
      );
      fs.writeFileSync(
        path.join(pkgPath, 'MpesaSmsPackage.kt'),
        KOTLIN_PACKAGE_TEMPLATE(pkg),
        'utf8'
      );
      return mod;
    },
  ]);

  config = withMainApplication(config, (mod) => {
    let contents = mod.modResults.contents;
    if (!contents.includes('MpesaSmsPackage()')) {
      contents = contents.replace(
        /PackageList\(this\)\.packages\.apply\s*\{/,
        'PackageList(this).packages.apply {\n              add(MpesaSmsPackage())'
      );
      mod.modResults.contents = contents;
    }
    return mod;
  });

  return config;
}

module.exports = withMpesaSmsListener;
