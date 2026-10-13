package io.github.yjw071218.sumdoku;

import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);

        FrameLayout rootLayout = new FrameLayout(this);
        setContentView(rootLayout);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setDatabaseEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

        // Native JavaScript Interface for Update and System Info
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public String getVersion() {
                try {
                    return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
                } catch (Exception e) {
                    return "1.0.0";
                }
            }

            @JavascriptInterface
            public boolean isTablet() {
                int screenLayout = getResources().getConfiguration().screenLayout;
                return (screenLayout & Configuration.SCREENLAYOUT_SIZE_MASK) >= Configuration.SCREENLAYOUT_SIZE_LARGE;
            }

            @JavascriptInterface
            public void openExternalUrl(String url) {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception ignored) {}
            }
        }, "AndroidBridge");

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());

        rootLayout.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            // Let JavaScript handle back to Home if in Game view
            if (webView != null) {
                webView.evaluateJavascript("if (window.app && window.app.handleBackKey) { window.app.handleBackKey(); } else { false; }", value -> {
                    if ("\"handled\"".equals(value) || "true".equals(value)) {
                        // handled by web
                    } else {
                        super.onBackPressed();
                    }
                });
            } else {
                super.onBackPressed();
            }
        }
    }
}
