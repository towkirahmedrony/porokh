package net.porokh.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Custom plugin that opens this app's Android notification settings.
        registerPlugin(NotificationSettingsPlugin.class);
        super.onCreate(savedInstanceState);
        applySplashBackgroundToWebView();
        ensureNotificationChannel();
    }

    /**
     * A WebView paints its own default (white) background as soon as it is
     * attached, before a single byte of HTML is parsed. Without this the gap
     * between the launch splash and the in-app splash was a white frame, which is
     * very visible on a dark-themed device.
     *
     * The colour is the same resource the launch theme uses, so it resolves to
     * #FFFFFF in light mode and #0A0A0B in night mode, matching the in-app
     * splash (src/splash/appSplash.ts) on both.
     */
    private void applySplashBackgroundToWebView() {
        if (getBridge() == null) return;

        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        webView.setBackgroundColor(ContextCompat.getColor(this, R.color.splash_background));
    }

    /**
     * Creates the channel before the first message can arrive. The name comes
     * from the device locale, so it stays localized; the JS side recreating the
     * same id later is a no-op for the user-visible name.
     */
    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        String channelId = getString(R.string.default_notification_channel_id);
        if (manager.getNotificationChannel(channelId) != null) return;

        NotificationChannel channel = new NotificationChannel(
            channelId,
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(getString(R.string.notification_channel_description));
        channel.enableVibration(true);
        manager.createNotificationChannel(channel);
    }
}
