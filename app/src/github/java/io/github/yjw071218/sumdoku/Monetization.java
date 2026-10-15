package io.github.yjw071218.sumdoku;

import android.app.Activity;
import android.webkit.WebView;
import android.widget.FrameLayout;

/** GitHub 배포판: 광고와 결제가 없습니다. 플레이판(src/play)과 같은 메서드를 빈 동작으로 제공합니다. */
public class Monetization {
    public Monetization(Activity activity, WebView webView, FrameLayout bannerHost) {}
    public boolean isSupported() { return false; }
    public String getMonetizationState() { return "{}"; }
    public void purchaseAdProduct(String id) {}
    public boolean isAdFree() { return true; }
    public void start() {}
    public void showInterstitial() {}
    public void showRewarded(String requestId) {}
    public boolean isRewardedReady() { return false; }
    public boolean isPrivacyOptionsRequired() { return false; }
    public void showPrivacyOptions() {}
    public String getRemoveAdsPrice() { return ""; }
    public void purchaseRemoveAds() {}
    public void restorePurchases() {}
    public void onResume() {}
    public void onPause() {}
    public void onDestroy() {}
}
