package com.tsaitunq.guides;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.tsaitunq.bazaarflip.ProfileStore;

import java.io.IOException;

// The guide app has no API key or profile any more. These three calls only let the update read the old profile once and
// delete the old key and profile (guide/migrate.js); they can go when every install has been through that.
@CapacitorPlugin(name = "BazaarAlerts")
public class GuidePlugin extends Plugin {
    @PluginMethod
    public void clearApiKey(PluginCall call) {
        try {
            ProfileStore.clearKey(getContext());
            call.resolve();
        } catch (IOException e) {
            call.reject("could not remove the key");
        }
    }

    @PluginMethod
    public void loadProfile(PluginCall call) {
        call.resolve(new JSObject().put("json", ProfileStore.loadProfile(getContext())));
    }

    @PluginMethod
    public void clearProfile(PluginCall call) {
        try {
            ProfileStore.clearProfile(getContext());
            call.resolve();
        } catch (IOException e) {
            call.reject("could not remove the profile");
        }
    }
}
