package com.agricovet.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                // Delete legacy channels if present
                try {
                    manager.deleteNotificationChannel("agricovet_orders_channel");
                    manager.deleteNotificationChannel("agricovet_orders_channel_v2");
                    manager.deleteNotificationChannel("agricovet_orders_channel_v3");
                } catch (Exception ignored) {}

                String channelId = "agricovet_orders_channel_v4";
                CharSequence name = "Pedidos y Facturación Agricovet";
                String description = "Notificaciones prioritarias con sonido de pedidos y facturas";
                int importance = NotificationManager.IMPORTANCE_HIGH;

                NotificationChannel channel = new NotificationChannel(channelId, name, importance);
                channel.setDescription(description);
                channel.enableLights(true);
                channel.setLightColor(Color.parseColor("#16a34a"));
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{0, 250, 150, 250});

                try {
                    Uri soundUri = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/" + R.raw.whatsapp);
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                            .build();
                    channel.setSound(soundUri, audioAttributes);
                } catch (Exception soundEx) {
                    // Fallback to default sound if raw resource fails
                }

                manager.createNotificationChannel(channel);
            }
        }
    }
}
