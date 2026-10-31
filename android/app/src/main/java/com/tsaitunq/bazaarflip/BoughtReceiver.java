package com.tsaitunq.bazaarflip;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONException;

/** The "Bought" action of a buying window notification: marks the item as held without opening the app. */
public class BoughtReceiver extends BroadcastReceiver {
    static final String EXTRA_ITEM = "item";
    static final String EXTRA_NOTIFICATION = "notification";

    @Override
    public void onReceive(Context context, Intent intent) {
        String id = intent.getStringExtra(EXTRA_ITEM);
        if (id != null) {
            try {
                AlertsPlugin.setHeld(context, id, true);
            } catch (JSONException e) {
                return; // stays open, so it can be tapped again or set on the item page
            }
        }
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(intent.getIntExtra(EXTRA_NOTIFICATION, 0));
    }
}
