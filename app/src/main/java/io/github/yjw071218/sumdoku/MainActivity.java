package io.github.yjw071218.sumdoku;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {
    private WebView webView;
    /** 플레이판: 광고·광고 제거 구매 / GitHub판: 빈 동작 */
    private Monetization monetization;
    private CloudGames cloudGames;
    private Leaderboards leaderboards;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private static final String PREFS_NAME = "sumdoku_app_prefs";
    private static final String KEY_HOT_VERSION = "hot_update_version";
    private android.content.BroadcastReceiver deviceStatusReceiver;
    private android.net.ConnectivityManager.NetworkCallback deviceNetworkCallback;
    private final Runnable statusRefresh = () -> {
        if (webView != null) webView.evaluateJavascript("window.onAppDeviceStatusChanged&&window.onAppDeviceStatusChanged()", null);
    };

    private void requestStatusRefresh() {
        mainHandler.removeCallbacks(statusRefresh);
        mainHandler.postDelayed(statusRefresh, 40);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (monetization != null) monetization.onResume();
        applyImmersive();
        if (deviceStatusReceiver == null) {
            deviceStatusReceiver = new android.content.BroadcastReceiver() {
                @Override public void onReceive(android.content.Context context, Intent intent) {
                    requestStatusRefresh();
                    String action = intent.getAction();
                    if (hasWindowFocus() && (Intent.ACTION_POWER_CONNECTED.equals(action) || Intent.ACTION_POWER_DISCONNECTED.equals(action))) applyImmersive();
                }
            };
            android.content.IntentFilter filter = new android.content.IntentFilter();
            filter.addAction(Intent.ACTION_BATTERY_CHANGED);
            filter.addAction(Intent.ACTION_POWER_CONNECTED);
            filter.addAction(Intent.ACTION_POWER_DISCONNECTED);
            filter.addAction(android.media.AudioManager.RINGER_MODE_CHANGED_ACTION);
            filter.addAction("android.media.INTERNAL_RINGER_MODE_CHANGED_ACTION");
            filter.addAction(android.app.NotificationManager.ACTION_INTERRUPTION_FILTER_CHANGED);
            filter.addAction(Intent.ACTION_AIRPLANE_MODE_CHANGED);
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(deviceStatusReceiver, filter, android.content.Context.RECEIVER_EXPORTED);
            else registerReceiver(deviceStatusReceiver, filter);
        }
        android.net.ConnectivityManager cm = (android.net.ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (cm != null && deviceNetworkCallback == null) {
            deviceNetworkCallback = new android.net.ConnectivityManager.NetworkCallback() {
                @Override public void onAvailable(android.net.Network network) { requestStatusRefresh(); }
                @Override public void onLost(android.net.Network network) { requestStatusRefresh(); }
                @Override public void onCapabilitiesChanged(android.net.Network network, android.net.NetworkCapabilities caps) { requestStatusRefresh(); }
            };
            cm.registerDefaultNetworkCallback(deviceNetworkCallback);
        }
        requestStatusRefresh();
    }

    @Override
    protected void onPause() {
        if (deviceStatusReceiver != null) { unregisterReceiver(deviceStatusReceiver); deviceStatusReceiver = null; }
        android.net.ConnectivityManager cm = (android.net.ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (cm != null && deviceNetworkCallback != null) cm.unregisterNetworkCallback(deviceNetworkCallback);
        deviceNetworkCallback = null;
        mainHandler.removeCallbacks(statusRefresh);
        if (monetization != null) monetization.onPause();
        super.onPause();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);

        // v1.1.1: 시스템 상태바를 숨기고 노치 영역까지 앱이 그립니다. 시간·배터리는 앱 전용 상태바(status-bar.js)가 표시합니다.
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        getWindow().setStatusBarColor(0x00000000);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        FrameLayout rootLayout = new FrameLayout(this);
        rootLayout.setFitsSystemWindows(false);
        rootLayout.setOnApplyWindowInsetsListener((v, insets) -> {
            // 충전·알림 등으로 시스템 상단바가 나타나면 곧바로 다시 숨깁니다.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && insets.isVisible(android.view.WindowInsets.Type.statusBars())) {
                mainHandler.removeCallbacks(rehideBars);
                mainHandler.postDelayed(rehideBars, 300);
            }
            float d = getResources().getDisplayMetrics().density;
            int sbHeight = 0;
            int sbResId = getResources().getIdentifier("status_bar_height", "dimen", "android");
            if (sbResId > 0) sbHeight = getResources().getDimensionPixelSize(sbResId);

            int cutTop = 0, cutBottom = 0;
            float cutLeftDp = -1f, cutRightDp = -1f;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && insets.getDisplayCutout() != null) {
                android.view.DisplayCutout cutout = insets.getDisplayCutout();
                cutTop = cutout.getSafeInsetTop();
                java.util.List<android.graphics.Rect> rects = cutout.getBoundingRects();
                if (rects != null && !rects.isEmpty()) {
                    android.graphics.Rect r = rects.get(0);
                    cutBottom = r.bottom;
                    cutLeftDp = r.left / d;
                    cutRightDp = r.right / d;
                }
            }
            int effectiveTop = Math.max(sbHeight, Math.max(cutTop, cutBottom));
            if (effectiveTop <= 0) effectiveTop = insets.getSystemWindowInsetTop();
            safeTopDp = effectiveTop > 0 ? (effectiveTop / d) : 36f;
            cutoutLeftDp = cutLeftDp;
            cutoutRightDp = cutRightDp;

            // 상단은 앱이 직접 처리하고, 내비게이션 바·키보드 영역만 비워 둡니다.
            v.setPadding(insets.getSystemWindowInsetLeft(), 0, insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            final float st = safeTopDp, cl = cutLeftDp, cr = cutRightDp;
            if (webView != null) webView.post(() -> {
                webView.evaluateJavascript("window.onAppCutout&&window.onAppCutout(" + st + "," + cl + "," + cr + ");window.onAppSafeTop&&window.onAppSafeTop(" + st + ")", null);
            });
            return insets;
        });
        setContentView(rootLayout);
        // WindowInsetsController는 창의 DecorView가 생성된 뒤에 접근해야 합니다.
        applyImmersive();

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setDatabaseEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // 인앱 업데이트 및 시스템 브릿지 등록
        webView.addJavascriptInterface(new AndroidBridgeInterface(), "AndroidBridge");

        // 최신 인앱 리소스(Hot Update) 가로채기 클라이언트
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!BuildConfig.SELF_UPDATE) return super.shouldInterceptRequest(view, request);
                File customDir = new File(getFilesDir(), "www");
                if (customDir.exists()) {
                    String path = request.getUrl().getPath();
                    if (path != null) {
                        if (path.endsWith("index.html")) {
                            File f = new File(customDir, "index.html");
                            if (f.exists()) {
                                try {
                                    return new WebResourceResponse("text/html", "UTF-8", new FileInputStream(f));
                                } catch (Exception ignored) {}
                            }
                        } else if (path.endsWith("style.css")) {
                            File f = new File(customDir, "style.css");
                            if (f.exists()) {
                                try {
                                    return new WebResourceResponse("text/css", "UTF-8", new FileInputStream(f));
                                } catch (Exception ignored) {}
                            }
                        } else if (path.endsWith("app.js")) {
                            File f = new File(customDir, "app.js");
                            if (f.exists()) {
                                try {
                                    return new WebResourceResponse("application/javascript", "UTF-8", new FileInputStream(f));
                                } catch (Exception ignored) {}
                            }
                        }
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }
        });

        webView.setWebChromeClient(new WebChromeClient());

        // 세로 배치: 게임 화면(WebView) + 하단 배너 자리(플레이판에서 광고가 로드될 때만 표시)
        android.widget.LinearLayout column = new android.widget.LinearLayout(this);
        column.setOrientation(android.widget.LinearLayout.VERTICAL);
        column.addView(webView, new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        FrameLayout bannerHost = new FrameLayout(this);
        bannerHost.setVisibility(android.view.View.GONE);
        column.addView(bannerHost, new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT));
        rootLayout.addView(column, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        cloudGames = new CloudGames(this, webView);
        leaderboards = new Leaderboards(this, webView);
        loadApp();
        monetization = new Monetization(this, webView, bannerHost);
        monetization.start();
    }

    private String getApkVersionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "1.1.16";
        }
    }

    private static boolean isVersionGreater(String v1, String v2) {
        if (v1 == null) return false;
        if (v2 == null) return true;
        try {
            String[] parts1 = v1.replace("v", "").trim().split("\\.");
            String[] parts2 = v2.replace("v", "").trim().split("\\.");
            int max = Math.max(parts1.length, parts2.length);
            for (int i = 0; i < max; i++) {
                int n1 = i < parts1.length ? Integer.parseInt(parts1[i].replaceAll("\\D+", "")) : 0;
                int n2 = i < parts2.length ? Integer.parseInt(parts2[i].replaceAll("\\D+", "")) : 0;
                if (n1 > n2) return true;
                if (n1 < n2) return false;
            }
        } catch (Exception ignored) {}
        return false;
    }

    private static boolean isVersionGreaterOrEqual(String v1, String v2) {
        if (v1 == null && v2 == null) return true;
        if (v1 != null && v1.equals(v2)) return true;
        return isVersionGreater(v1, v2);
    }

    private void loadApp() {
        File customDir = new File(getFilesDir(), "www");
        File customIndex = new File(customDir, "index.html");

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String hotVersion = prefs.getString(KEY_HOT_VERSION, null);
        String apkVersion = getApkVersionName();

        // 플레이판은 앱 밖에서 받은 화면 파일을 쓰지 않습니다(이전 캐시가 있으면 삭제).
        if (!BuildConfig.SELF_UPDATE && hotVersion != null) {
            deleteDir(customDir);
            prefs.edit().remove(KEY_HOT_VERSION).apply();
            hotVersion = null;
        }

        // APK 버전이 기존 hot_update 버전과 같거나 더 높으면 불필요한 구버전 캐시 삭제 후 APK 에셋 로드
        if (hotVersion != null && isVersionGreaterOrEqual(apkVersion, hotVersion)) {
            deleteDir(customDir);
            prefs.edit().remove(KEY_HOT_VERSION).apply();
            hotVersion = null;
        }

        // 구버전 파일이 www 폴더에 남아있는 경우 정리
        if (hotVersion == null && customDir.exists()) {
            deleteDir(customDir);
        }

        if (hotVersion != null && customIndex.exists()) {
            webView.loadUrl("file://" + customIndex.getAbsolutePath());
        } else {
            webView.loadUrl("file:///android_asset/index.html");
        }
    }

    private BattleServer battleServer;
    // 일부 기기는 이 잠금이 없으면 방장 쪽에서 브로드캐스트 패킷을 버립니다.
    private android.net.wifi.WifiManager.MulticastLock multicastLock;
    private android.net.wifi.WifiManager.WifiLock wifiLock;

    private void setMulticast(boolean on) {
        try {
            if (on) {
                if (multicastLock == null) {
                    android.net.wifi.WifiManager wm = (android.net.wifi.WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
                    if (wm == null) return;
                    multicastLock = wm.createMulticastLock("sumdoku-discovery");
                    multicastLock.setReferenceCounted(false);
                }
                multicastLock.acquire();
                // 방이 열려 있는 동안 Wi-Fi 절전으로 탐색 응답이 늦어지지 않게 합니다.
                if (wifiLock == null) {
                    android.net.wifi.WifiManager wm = (android.net.wifi.WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
                    if (wm != null) {
                        @SuppressWarnings("deprecation") int mode = Build.VERSION.SDK_INT >= 29 ? android.net.wifi.WifiManager.WIFI_MODE_FULL_LOW_LATENCY : android.net.wifi.WifiManager.WIFI_MODE_FULL_HIGH_PERF;
                        wifiLock = wm.createWifiLock(mode, "sumdoku-battle");
                        wifiLock.setReferenceCounted(false);
                    }
                }
                if (wifiLock != null) wifiLock.acquire();
            } else {
                if (multicastLock != null && multicastLock.isHeld()) multicastLock.release();
                if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
            }
        } catch (Exception ignored) {}
    }

    @Override
    protected void onDestroy() {
        if (battleServer != null) {
            battleServer.stop();
        }
        setMulticast(false);
        if (monetization != null) monetization.onDestroy();
        super.onDestroy();
    }

    private volatile float safeTopDp = 36f;
    private volatile float cutoutLeftDp = -1f;
    private volatile float cutoutRightDp = -1f;

    @SuppressWarnings("deprecation")
    private void applyImmersive() {
        // onCreate/포커스 콜백 어디서 호출해도 창의 최상위 뷰를 먼저 생성합니다.
        android.view.View decor = getWindow().getDecorView();
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            android.view.WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.setSystemBarsBehavior(android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(android.view.WindowInsets.Type.statusBars());
            }
            return;
        }
        decor.setSystemUiVisibility(
            android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
            | android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    private final Runnable rehideBars = this::applyImmersive;

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) { applyImmersive(); requestStatusRefresh(); }
    }

    /** 배틀 중에는 모든 소켓을 Wi-Fi에 고정합니다. Wi-Fi에 인터넷이 없으면 Android가 모바일 데이터를 기본 경로로 써서 방 탐색·접속이 실패할 수 있습니다. */
    private boolean bindToWifi(boolean on) {
        android.net.ConnectivityManager cm = (android.net.ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        if (!on) { cm.bindProcessToNetwork(null); return true; }
        for (android.net.Network network : cm.getAllNetworks()) {
            android.net.NetworkCapabilities caps = cm.getNetworkCapabilities(network);
            if (caps != null && caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI)) return cm.bindProcessToNetwork(network);
        }
        return false;
    }

    private boolean isMobileDataOn() {
        // 1. 전화/유심 기능이 없으면(태블릿, Wi-Fi 전용 기기) 무조건 false
        try {
            if (!getPackageManager().hasSystemFeature(android.content.pm.PackageManager.FEATURE_TELEPHONY)) return false;
            android.telephony.TelephonyManager tm = (android.telephony.TelephonyManager) getSystemService(TELEPHONY_SERVICE);
            if (tm == null || tm.getSimState() != android.telephony.TelephonyManager.SIM_STATE_READY) return false;
            if (Build.VERSION.SDK_INT >= 26 && tm.getPhoneType() == android.telephony.TelephonyManager.PHONE_TYPE_NONE) return false;

            // 2. Android 시스템 설정의 모바일 데이터 토글 스위치 상태를 최우선 확인
            // (사용자가 퀵패널/설정에서 모바일 데이터를 껐다면 반드시 false)
            if (Build.VERSION.SDK_INT >= 26) {
                return tm.isDataEnabled();
            }
        } catch (Exception ignored) {}

        // 3. 글로벌 설정값 확인
        try {
            int md = android.provider.Settings.Global.getInt(getContentResolver(), "mobile_data", -1);
            if (md != -1) return md == 1;
        } catch (Exception ignored) {}

        // 4. 셀룰러 인터넷 데이터망이 실제로 활성화되어 있는지 확인
        // (주의: VoLTE/IMS 전용 셀룰러 모뎀 네트워크는 NET_CAPABILITY_INTERNET이 없으므로 제외해야 함)
        try {
            android.net.ConnectivityManager cm = (android.net.ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
            if (cm != null) for (android.net.Network n : cm.getAllNetworks()) {
                android.net.NetworkCapabilities c = cm.getNetworkCapabilities(n);
                if (c != null && c.hasTransport(android.net.NetworkCapabilities.TRANSPORT_CELLULAR)
                        && c.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
                    return true;
                }
            }
        } catch (Exception ignored) {}

        return false;
    }


    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (cloudGames != null) cloudGames.result(request, result, data);
    }
    private class AndroidBridgeInterface {
        @JavascriptInterface public boolean isCloudConfigured() { return BuildConfig.GAMES_CONFIGURED; }
        @JavascriptInterface public void cloudSignIn() { if(cloudGames!=null) cloudGames.signIn(); }
        @JavascriptInterface public void cloudSave(String data) { if(cloudGames!=null) cloudGames.save(data); }
        @JavascriptInterface public void cloudLoad() { if(cloudGames!=null) cloudGames.load(); }
        @JavascriptInterface public boolean isLeaderboardConfigured(String key) { return leaderboards != null && leaderboards.isConfigured(key); }
        @JavascriptInterface public void submitLeaderboardScore(String key, String score) { try { if (leaderboards != null) leaderboards.submit(key, Long.parseLong(score)); } catch (NumberFormatException ignored) {} }
        @JavascriptInterface public void showLeaderboard(String key) { if (leaderboards != null) leaderboards.show(key); }
        @JavascriptInterface public void loadLeaderboardRanks(String key, int max, boolean interactive) { if (leaderboards != null) leaderboards.load(key, max, interactive); }

        // ---------------- 배포판 · 광고 · 광고 제거 구매 ----------------
        @JavascriptInterface public String getDistribution() { return BuildConfig.DISTRIBUTION; }
        @JavascriptInterface public boolean isSelfUpdateAllowed() { return BuildConfig.SELF_UPDATE; }
        @JavascriptInterface public boolean isMonetizationSupported() { return monetization != null && monetization.isSupported(); }
        @JavascriptInterface public String getMonetizationState() { return monetization == null ? "{}" : monetization.getMonetizationState(); }
        @JavascriptInterface public void purchaseAdProduct(String id) { if(monetization != null) monetization.purchaseAdProduct(id); }
        @JavascriptInterface public boolean isAdFree() { return monetization == null || monetization.isAdFree(); }
        @JavascriptInterface public String getRemoveAdsPrice() { return monetization == null ? "" : monetization.getRemoveAdsPrice(); }
        @JavascriptInterface public void purchaseRemoveAds() { if (monetization != null) monetization.purchaseRemoveAds(); }
        @JavascriptInterface public void restorePurchases() { if (monetization != null) monetization.restorePurchases(); }
        @JavascriptInterface public void showInterstitial() { if (monetization != null) monetization.showInterstitial(); }
        @JavascriptInterface public void showRewarded(String requestId) { if (monetization != null) monetization.showRewarded(requestId); }
        @JavascriptInterface public boolean isRewardedReady() { return monetization != null && monetization.isRewardedReady(); }
        @JavascriptInterface public boolean isPrivacyOptionsRequired() { return monetization != null && monetization.isPrivacyOptionsRequired(); }
        @JavascriptInterface public void showPrivacyOptions() { if (monetization != null) monetization.showPrivacyOptions(); }

        @JavascriptInterface
        public boolean isMobileDataEnabled() { return isMobileDataOn(); }

        @JavascriptInterface
        public boolean setBattleNetwork(boolean on) { return bindToWifi(on); }

        @JavascriptInterface
        public boolean isWifiConnected() {
            android.net.ConnectivityManager cm = (android.net.ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
            if (cm == null) return false;
            // 기본 인터넷 경로가 모바일 데이터여도 연결된 로컬 Wi-Fi가 있으면 허용합니다.
            for (android.net.Network network : cm.getAllNetworks()) {
                android.net.NetworkCapabilities capabilities = cm.getNetworkCapabilities(network);
                if (capabilities != null && capabilities.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI)) return true;
            }
            return false;
        }

        /** v1.1.1 앱 전용 상태바: 시간, 배터리, 실제 활성 모드/네트워크 상태만 제공 */
        @JavascriptInterface
        public String getDeviceStatus() {
            int level = -1; boolean charging = false;
            try {
                Intent b = registerReceiver(null, new android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED));
                if (b != null) {
                    int l = b.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1), sc = b.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, 100);
                    if (l >= 0 && sc > 0) level = Math.round(l * 100f / sc);
                    int st = b.getIntExtra(android.os.BatteryManager.EXTRA_STATUS, -1);
                    boolean plugged = b.getIntExtra(android.os.BatteryManager.EXTRA_PLUGGED, 0) != 0;
                    charging = plugged && (st == android.os.BatteryManager.BATTERY_STATUS_CHARGING || st == android.os.BatteryManager.BATTERY_STATUS_FULL);
                }
            } catch (Exception ignored) {}
            boolean wifi = false, cellular = false, internet = false;
            try {
                android.net.ConnectivityManager cm = (android.net.ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
                if (cm != null) {
                    android.net.NetworkCapabilities nc = cm.getNetworkCapabilities(cm.getActiveNetwork());
                    if (nc != null) {
                        wifi = nc.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI);
                        cellular = nc.hasTransport(android.net.NetworkCapabilities.TRANSPORT_CELLULAR);
                        internet = nc.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED);
                    }
                }
            } catch (Exception ignored) {}
            String ringer = "normal"; boolean dnd = false;
            try {
                android.media.AudioManager am = (android.media.AudioManager) getSystemService(AUDIO_SERVICE);
                if (am != null) {
                    // 사용자가 설정한 벨소리 모드를 우선 사용합니다. getRingerMode()는 방해 금지 등에 의해 무음으로 보고될 수 있습니다.
                    int rm = android.provider.Settings.Global.getInt(getContentResolver(), "mode_ringer", am.getRingerMode());
                    ringer = rm == android.media.AudioManager.RINGER_MODE_VIBRATE ? "vibrate" : rm == android.media.AudioManager.RINGER_MODE_SILENT ? "silent" : "normal";
                }
            } catch (Exception ignored) {}
            try {
                android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                if (nm != null) {
                    dnd = nm.getCurrentInterruptionFilter() > android.app.NotificationManager.INTERRUPTION_FILTER_ALL;
                }
            } catch (Exception ignored) {}
            boolean airplane = false;
            try {
                airplane = Settings.Global.getInt(getContentResolver(), Settings.Global.AIRPLANE_MODE_ON, 0) != 0;
            } catch (Exception ignored) {}
            boolean is24 = android.text.format.DateFormat.is24HourFormat(MainActivity.this);
            return String.format(java.util.Locale.ROOT,
                "{\"level\":%d,\"charging\":%b,\"wifi\":%b,\"cellular\":%b,\"internet\":%b,\"airplane\":%b,\"ringer\":\"%s\",\"dnd\":%b,\"is24\":%b,\"safeTop\":%.1f,\"cutLeft\":%.1f,\"cutRight\":%.1f}",
                level, charging, wifi, cellular, internet, airplane, ringer, dnd, is24, safeTopDp, cutoutLeftDp, cutoutRightDp);
        }

        @JavascriptInterface
        public String getLocalIpAddress() {
            return BattleServer.getLocalIpAddress();
        }

        @JavascriptInterface
        public String startBattleServer(String mode, String diff, int timeLimitSec, String puzzleJson) {
            if (battleServer == null) {
                battleServer = new BattleServer();
            }
            battleServer.configureRoom(mode, diff, timeLimitSec, puzzleJson);
            bindToWifi(true);
            boolean ok = battleServer.start(8888);
            if (ok) setMulticast(true);
            String ip = BattleServer.getLocalIpAddress();
            long address = 0;
            for (String octet : ip.split("\\.")) address = address * 256 + Integer.parseInt(octet);
            String code = String.format(java.util.Locale.ROOT, "%010d%02d", address, address % 97);
            return String.format("{\"ok\":%b,\"ip\":\"%s\",\"port\":8888,\"code\":\"%s\"}", ok, ip, code);
        }

        /** v1.0.42: 4자리 코드로 방 찾기(비동기). 최근 접속 IP가 있으면 우선 확인합니다. */
        @JavascriptInterface
        public void findRoomAsync(final String code, final String lastHost) {
            bindToWifi(true);
            RoomDiscovery.find(code, lastHost, json -> mainHandler.post(() ->
                webView.evaluateJavascript("if (window.onRoomFound) { window.onRoomFound(" + json + "); }", null)));
        }

        @JavascriptInterface
        public void findRoomAsync(final String code) {
            findRoomAsync(code, null);
        }

        @JavascriptInterface
        public void stopBattleServer() {
            if (battleServer != null) {
                battleServer.stop();
            }
            setMulticast(false);
        }

        @JavascriptInterface
        public boolean isBattleServerRunning() {
            return battleServer != null && battleServer.isRunning();
        }

        @JavascriptInterface
        public String getVersion() {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String hotVersion = prefs.getString(KEY_HOT_VERSION, null);
            String apkVersion = getApkVersionName();
            if (hotVersion != null && !hotVersion.isEmpty() && isVersionGreater(hotVersion, apkVersion)) {
                return hotVersion;
            }
            return apkVersion;
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

        /**
         * 1. 인앱 즉시 리소스 업데이트 (OTA Hot Update)
         * - APK 다운로드나 재설치 없이 내부 저장소로 최신 코드를 다운로드받아 즉시 재시작
         */
        @JavascriptInterface
        public void downloadAndApplyWebUpdate(final String versionTag) {
            if (!BuildConfig.SELF_UPDATE) return;
            new Thread(() -> {
                try {
                    sendProgress(10, "최신 리소스 다운로드 준비 중...");
                    String baseUrl = BuildConfig.WEB_UPDATE_BASE_URL;
                    if (baseUrl.isEmpty()) return;

                    byte[] indexBytes = downloadUrlBytes(baseUrl + "index.html");
                    sendProgress(40, "HTML/구조 파일 업데이트 중...");

                    byte[] cssBytes = downloadUrlBytes(baseUrl + "style.css");
                    sendProgress(65, "스타일시트 업데이트 중...");

                    byte[] jsBytes = downloadUrlBytes(baseUrl + "app.js");
                    sendProgress(90, "게임 로직 및 알고리즘 업데이트 중...");

                    if (indexBytes.length > 500 && cssBytes.length > 500 && jsBytes.length > 1000) {
                        File wwwDir = new File(getFilesDir(), "www");
                        if (!wwwDir.exists()) wwwDir.mkdirs();

                        writeFile(new File(wwwDir, "index.html"), indexBytes);
                        writeFile(new File(wwwDir, "style.css"), cssBytes);
                        writeFile(new File(wwwDir, "app.js"), jsBytes);

                        // 버전 저장
                        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                        prefs.edit().putString(KEY_HOT_VERSION, versionTag).apply();

                        sendProgress(100, "업데이트 완료! 앱을 즉시 재시작합니다...");

                        mainHandler.postDelayed(() -> {
                            Toast.makeText(MainActivity.this, "v" + versionTag + " 버전으로 인앱 업데이트되었습니다!", Toast.LENGTH_SHORT).show();
                            loadApp();
                        }, 500);
                    } else {
                        sendError("다운로드된 파일 검증에 실패했습니다.");
                    }
                } catch (Exception e) {
                    sendError("인앱 업데이트 실패: " + e.getMessage());
                }
            }).start();
        }

        /**
         * 2. 인앱 APK 다운로더 & 원클릭 설치기
         * - 브라우저 이동 없이 앱 내부에서 직접 APK를 다운로드받고 바로 안드로이드 설치 창 호출
         */
        @JavascriptInterface
        public void downloadAndInstallApk(final String apkUrl) {
            if (!BuildConfig.SELF_UPDATE) return;
            new Thread(() -> {
                try {
                    sendProgress(5, "APK 다운로드 연결 중...");

                    URL url = new URL(apkUrl);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setInstanceFollowRedirects(true);
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);

                    // 다운로드 서버 리다이렉트 대응 (302/307)
                    int status = conn.getResponseCode();
                    if (status == HttpURLConnection.HTTP_MOVED_TEMP || status == HttpURLConnection.HTTP_MOVED_PERM || status == 307 || status == 308) {
                        String redirectedUrl = conn.getHeaderField("Location");
                        conn = (HttpURLConnection) new URL(redirectedUrl).openConnection();
                        conn.setConnectTimeout(15000);
                        conn.setReadTimeout(30000);
                    }

                    int totalLength = conn.getContentLength();
                    InputStream in = new BufferedInputStream(conn.getInputStream());
                    File apkFile = new File(getCacheDir(), "update.apk");
                    FileOutputStream out = new FileOutputStream(apkFile);

                    byte[] buffer = new byte[8192];
                    int read;
                    long totalRead = 0;
                    long lastUpdateTime = 0;

                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                        totalRead += read;

                        long now = System.currentTimeMillis();
                        if (now - lastUpdateTime > 100) {
                            lastUpdateTime = now;
                            int percent = totalLength > 0 ? (int) ((totalRead * 100) / totalLength) : 50;
                            String msg = String.format("APK 다운로드 중: %d%% (%d KB / %d KB)",
                                percent, totalRead / 1024, (totalLength > 0 ? totalLength : totalRead) / 1024);
                            sendProgress(percent, msg);
                        }
                    }

                    out.flush();
                    out.close();
                    in.close();

                    if (!apkFile.exists() || apkFile.length() < 10000) {
                        sendError("다운로드된 APK 파일이 손상되었습니다.");
                        return;
                    }

                    sendProgress(100, "다운로드 완료! 패키지 설치 창을 엽니다...");

                    mainHandler.post(() -> launchApkInstaller(apkFile));
                } catch (Exception e) {
                    sendError("APK 다운로드 실패: " + e.getMessage());
                }
            }).start();
        }

        @JavascriptInterface
        public void resetToFactoryAssets() {
            File wwwDir = new File(getFilesDir(), "www");
            if (wwwDir.exists()) {
                deleteDir(wwwDir);
            }
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            prefs.edit().remove(KEY_HOT_VERSION).apply();
            mainHandler.post(() -> loadApp());
        }

        /**
         * 3. 앱 삭제 후 재설치 시에도 데이터 보존을 위한 공용 외부 저장소 영구 백업
         * - 공용 Documents 폴더(Documents/Sumdoku/sumdoku_persistent_data.json)는 앱을 삭제해도 보존됨
         */
        @JavascriptInterface
        public void savePersistentBackup(final String jsonData) {
            new Thread(() -> {
                try {
                    File docDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS);
                    File sumdokuDir = new File(docDir, "Sumdoku");
                    if (!sumdokuDir.exists()) sumdokuDir.mkdirs();
                    File backupFile = new File(sumdokuDir, "sumdoku_persistent_data.json");
                    writeFile(backupFile, jsonData.getBytes("UTF-8"));
                } catch (Exception ignored) {}
            }).start();
        }

        @JavascriptInterface
        public String loadPersistentBackup() {
            try {
                File docDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS);
                File backupFile = new File(new File(docDir, "Sumdoku"), "sumdoku_persistent_data.json");
                if (backupFile.exists() && backupFile.length() > 0) {
                    byte[] bytes = new byte[(int) backupFile.length()];
                    FileInputStream fis = new FileInputStream(backupFile);
                    fis.read(bytes);
                    fis.close();
                    return new String(bytes, "UTF-8");
                }
            } catch (Exception ignored) {}
            return null;
        }

        @JavascriptInterface
        public void copyToClipboard(final String text) {
            mainHandler.post(() -> {
                try {
                    android.content.ClipboardManager clipboard = (android.content.ClipboardManager) MainActivity.this.getSystemService(android.content.Context.CLIPBOARD_SERVICE);
                    if (clipboard != null) {
                        android.content.ClipData clip = android.content.ClipData.newPlainText("Sumdoku Room Code", text);
                        clipboard.setPrimaryClip(clip);
                    }
                } catch (Exception ignored) {}
            });
        }
    }

    private void launchApkInstaller(File apkFile) {
        try {
            // Android 8.0+ 출처를 알 수 없는 앱 설치 권한 확인
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!getPackageManager().canRequestPackageInstalls()) {
                    Toast.makeText(this, "업데이트 설치를 위해 '이 출처의 앱 허용'을 활성화해 주세요.", Toast.LENGTH_LONG).show();
                    Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    settingsIntent.setData(Uri.parse("package:" + getPackageName()));
                    settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(settingsIntent);
                    return;
                }
            }

            Uri apkUri = Uri.parse("content://" + AppFileProvider.AUTHORITY + "/update.apk");
            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(installIntent);
        } catch (Exception e) {
            Toast.makeText(this, "설치 관리자 호출 실패: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private byte[] downloadUrlBytes(String urlStr) throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(15000);
        int code = conn.getResponseCode();
        if (code != 200) throw new Exception("HTTP " + code);

        InputStream in = conn.getInputStream();
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int r;
        while ((r = in.read(buf)) != -1) {
            baos.write(buf, 0, r);
        }
        in.close();
        return baos.toByteArray();
    }

    private void writeFile(File f, byte[] data) throws Exception {
        FileOutputStream fos = new FileOutputStream(f);
        fos.write(data);
        fos.flush();
        fos.close();
    }

    private void deleteDir(File dir) {
        File[] files = dir.listFiles();
        if (files != null) {
            for (File f : files) {
                if (f.isDirectory()) deleteDir(f);
                else f.delete();
            }
        }
        dir.delete();
    }

    private void sendProgress(final int percent, final String message) {
        mainHandler.post(() -> {
            String escaped = message.replace("'", "\\'").replace("\n", " ");
            webView.evaluateJavascript("if (window.onUpdateProgress) { window.onUpdateProgress(" + percent + ", '" + escaped + "'); }", null);
        });
    }

    private void sendError(final String errorMessage) {
        mainHandler.post(() -> {
            String escaped = errorMessage.replace("'", "\\'");
            webView.evaluateJavascript("if (window.onUpdateError) { window.onUpdateError('" + escaped + "'); }", null);
            Toast.makeText(MainActivity.this, errorMessage, Toast.LENGTH_SHORT).show();
        });
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
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
