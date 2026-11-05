package com.tsaitunq.bazaarflip;

import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlertsPlugin.class);
        super.onCreate(savedInstanceState);

        // Without this the system back key closes the app even on the item detail page.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView web = getBridge().getWebView();
                if (web.canGoBack()) web.goBack();
                else finish();
            }
        });
    }
}
