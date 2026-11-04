package net.porokh.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Custom plugin that opens this app's Android notification settings.
        registerPlugin(NotificationSettingsPlugin.class);
        super.onCreate(savedInstanceState);
        ensureNotificationChannel();
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
