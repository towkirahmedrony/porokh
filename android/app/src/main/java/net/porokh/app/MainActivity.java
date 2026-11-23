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
        ensureNotificationChannels();
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
     * Creates the four channels the backend addresses: exam, security, general
     * and social. An Android 8+ notification naming a channel that does not
     * exist is dropped silently, so they must exist before the first message.
     *
     * Exam and security are high importance (heads-up, sound); general and
     * social are default so a busy chat cannot interrupt a study session.
     */
    private void ensureNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        createChannel(
            manager,
            getString(R.string.channel_exam_id),
            getString(R.string.channel_exam_name),
            getString(R.string.channel_exam_description),
            NotificationManager.IMPORTANCE_HIGH
        );
        createChannel(
            manager,
            getString(R.string.channel_security_id),
            getString(R.string.channel_security_name),
            getString(R.string.channel_security_description),
            NotificationManager.IMPORTANCE_HIGH
        );
        createChannel(
            manager,
            getString(R.string.channel_general_id),
            getString(R.string.channel_general_name),
            getString(R.string.channel_general_description),
            NotificationManager.IMPORTANCE_DEFAULT
        );
        createChannel(
            manager,
            getString(R.string.channel_social_id),
            getString(R.string.channel_social_name),
            getString(R.string.channel_social_description),
            NotificationManager.IMPORTANCE_DEFAULT
        );
    }

    private void createChannel(
        NotificationManager manager,
        String channelId,
        String name,
        String description,
        int importance
    ) {
        if (manager.getNotificationChannel(channelId) != null) return;

        NotificationChannel channel = new NotificationChannel(channelId, name, importance);
        channel.setDescription(description);
        channel.enableVibration(true);
        manager.createNotificationChannel(channel);
    }
}
