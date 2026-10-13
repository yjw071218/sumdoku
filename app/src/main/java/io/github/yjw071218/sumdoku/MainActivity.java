package io.github.yjw071218.sumdoku;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
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
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private static final String PREFS_NAME = "sumdoku_app_prefs";
    private static final String KEY_HOT_VERSION = "hot_update_version";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);

        // Status bar styling (light theme with dark icons)
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        getWindow().setStatusBarColor(0xFFF8FAFC);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }

        FrameLayout rootLayout = new FrameLayout(this);
        rootLayout.setFitsSystemWindows(true);
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
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // 인앱 업데이트 및 시스템 브릿지 등록
        webView.addJavascriptInterface(new AndroidBridgeInterface(), "AndroidBridge");

        // 최신 인앱 리소스(Hot Update) 가로채기 클라이언트
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
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

        rootLayout.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        loadApp();
    }

    private String getApkVersionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "1.0.12";
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

        // APK 버전이 기존 hot_update 버전과 같거나 더 높으면 불필요한 구버전 캐시 삭제 후 APK 에셋 로드
        if (hotVersion != null && isVersionGreaterOrEqual(apkVersion, hotVersion)) {
            deleteDir(customDir);
            prefs.edit().remove(KEY_HOT_VERSION).apply();
            hotVersion = null;
        }

        if (hotVersion != null && customIndex.exists()) {
            webView.loadUrl("file://" + customIndex.getAbsolutePath());
        } else {
            webView.loadUrl("file:///android_asset/index.html");
        }
    }

    private BattleServer battleServer;

    @Override
    protected void onDestroy() {
        if (battleServer != null) {
            battleServer.stop();
        }
        super.onDestroy();
    }

    private class AndroidBridgeInterface {
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
            boolean ok = battleServer.start(8888);
            String ip = BattleServer.getLocalIpAddress();
            String code = ip.contains(".") ? ip.substring(ip.lastIndexOf('.') + 1) : "88";
            return String.format("{\"ok\":%b,\"ip\":\"%s\",\"port\":8888,\"code\":\"%s\"}", ok, ip, code);
        }

        @JavascriptInterface
        public void stopBattleServer() {
            if (battleServer != null) {
                battleServer.stop();
            }
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
            new Thread(() -> {
                try {
                    sendProgress(10, "최신 리소스 다운로드 준비 중...");
                    String baseUrl = "https://raw.githubusercontent.com/yjw071218/sumdoku/main/app/src/main/assets/";

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
            new Thread(() -> {
                try {
                    sendProgress(5, "APK 다운로드 연결 중...");

                    URL url = new URL(apkUrl);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setInstanceFollowRedirects(true);
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);

                    // GitHub 리다이렉트 대응 (302/307)
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
