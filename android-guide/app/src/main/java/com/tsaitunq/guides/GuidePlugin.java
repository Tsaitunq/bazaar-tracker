package com.tsaitunq.guides;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.tsaitunq.bazaarflip.ProfileStore;

import java.io.IOException;
import java.security.GeneralSecurityException;

// Key and profile only. The name is what the shared native.js looks for, the alerts of the Bazaar app are not in here.
@CapacitorPlugin(name = "BazaarAlerts")
public class GuidePlugin extends Plugin {
    @PluginMethod
    public void setApiKey(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.isEmpty()) {
            call.reject("no key");
            return;
        }
        try {
            ProfileStore.setKey(getContext(), key);
            call.resolve();
        } catch (GeneralSecurityException | IOException | RuntimeException e) {
            call.reject("could not store the key");
        }
    }

    @PluginMethod
    public void getApiKey(PluginCall call) {
        try {
            call.resolve(new JSObject().put("key", ProfileStore.getKey(getContext())));
        } catch (GeneralSecurityException | IOException | RuntimeException e) {
            call.reject("could not read the key");
        }
    }

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
    public void saveProfile(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("no profile");
            return;
        }
        try {
            ProfileStore.saveProfile(getContext(), json);
            call.resolve();
        } catch (IOException e) {
            call.reject("could not store the profile");
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
