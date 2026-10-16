package io.github.yjw071218.sumdoku;

import android.app.Activity;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.View;
import android.webkit.WebView;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Google Play 배포판의 광고(AdMob)와 '광고 제거' 일회성 구매(Play 결제).
 * <ul>
 *   <li>UMP로 개인정보 동의를 먼저 받고, 광고 요청이 허용될 때만 광고 SDK를 시작합니다.</li>
 *   <li>배너: 화면 맨 아래(WebView 바깥)에 고정. 보드·키패드를 가리지 않습니다.</li>
 *   <li>전면 광고: 게임 결과 화면에서만, 최소 3분 간격·결과 2회마다 1회로 제한합니다.</li>
 *   <li>부분 제거는 배너·전면만, 전체 제거는 보상형까지 제거합니다.</li>
 * </ul>
 */
public class Monetization implements PurchasesUpdatedListener {
    public static final String REMOVE_ADS_PRODUCT_ID = "remove_ads";
    private static final String PREFS = "sumdoku_monetization";
    private static final String KEY_AD_FREE = "ad_free";
    private static final long INTERSTITIAL_MIN_GAP_MS = 3 * 60 * 1000L;
    private static final int RESULTS_PER_INTERSTITIAL = 2;

    private final Activity activity;
    private final WebView webView;
    private final FrameLayout bannerHost;
    private final SharedPreferences prefs;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicBoolean adsStarted = new AtomicBoolean(false);

    private ConsentInformation consent;
    private AdView banner;
    private InterstitialAd interstitial;
    private boolean interstitialLoading;
    private boolean adsInitialized;
    private long lastInterstitialAt = 0;
    private int resultsSinceInterstitial = 0;
    private RewardedAd rewarded;
    private boolean rewardedLoading;

    private BillingClient billing;
    private final java.util.Map<String,ProductDetails> products = new java.util.concurrent.ConcurrentHashMap<>();
    private boolean purchasing, connecting;
    private int ownedGeneration;
    private final java.util.List<Runnable> connectionWaiters = new java.util.ArrayList<>();
    // v1.1.30: 상품 조회 진단 정보. 가격이 비어 있을 때 '가격 확인 중'에 멈추지 않고 원인을 화면에 표시합니다.
    private int billingCode = -100;            // -100 = 아직 조회 전
    private String billingDebug = "";
    private String missingProducts = "";
    private int productRetry = 0;

    public Monetization(Activity activity, WebView webView, FrameLayout bannerHost) {
        this.activity = activity;
        this.webView = webView;
        this.bannerHost = bannerHost;
        this.prefs = activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE);
    }

    public boolean isSupported() { return true; }

    public int getAdTier() { return prefs.getInt("ad_tier", prefs.getBoolean(KEY_AD_FREE, false) ? 2 : 0); }
    public boolean isAdFree() { return getAdTier() == 2; }
    public boolean isForcedAdsRemoved() { return getAdTier() >= 1; }

    public void start() {
        startBilling();
        requestConsentThenAds();
    }

    // ------------------------------------------------------------------ 동의 · 광고
    private void requestConsentThenAds() {
        consent = UserMessagingPlatform.getConsentInformation(activity);
        ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
        consent.requestConsentInfoUpdate(activity, params,
            () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, formError -> {
                if (consent.canRequestAds()) startAds();
                notifyJs();
            }),
            requestError -> {
                // 동의 정보 조회 실패: 이전에 받은 동의가 있으면 그대로 진행합니다.
                if (consent.canRequestAds()) startAds();
            });
        // 이전 실행에서 이미 동의했다면 조회 결과를 기다리지 않고 바로 시작합니다.
        if (consent.canRequestAds()) startAds();
    }

    private void startAds() {
        if (isAdFree() || !adsStarted.compareAndSet(false, true)) return;
        new Thread(() -> {
            MobileAds.initialize(activity, status -> main.post(() -> { adsInitialized=true; loadBanner(); loadInterstitial(); loadRewarded(); }));
        }).start();
    }

    private void loadBanner() {
        if (!adsInitialized || isForcedAdsRemoved() || banner != null || activity.isFinishing()) return;
        banner = new AdView(activity);
        banner.setAdUnitId(BuildConfig.ADMOB_BANNER_ID);
        banner.setAdSize(adaptiveSize());
        banner.setAdListener(new AdListener() {
            @Override public void onAdLoaded() { if (!isForcedAdsRemoved() && banner != null) bannerHost.setVisibility(View.VISIBLE); }
            @Override public void onAdFailedToLoad(@NonNull LoadAdError error) { bannerHost.setVisibility(View.GONE); }
        });
        bannerHost.removeAllViews();
        bannerHost.addView(banner, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER_HORIZONTAL));
        banner.loadAd(new AdRequest.Builder().build());
    }

    private AdSize adaptiveSize() {
        DisplayMetrics m = activity.getResources().getDisplayMetrics();
        int widthDp = (int) (m.widthPixels / m.density);
        // v1.1.30: 화면 전체 폭 적응형 배너는 태블릿·가로 화면에서 90dp 이상으로 커져 탭 화면을 많이 가립니다.
        //          폭을 320dp로 제한해 높이를 표준 배너(약 50dp) 수준으로 유지합니다.
        return AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity, Math.min(widthDp, 320));
    }

    private void removeBanner() {
        if (banner != null) { banner.destroy(); banner = null; }
        bannerHost.removeAllViews();
        bannerHost.setVisibility(View.GONE);
    }

    private void loadInterstitial() {
        if (isForcedAdsRemoved() || interstitial != null || interstitialLoading || !adsInitialized) return;
        interstitialLoading = true;
        InterstitialAd.load(activity, BuildConfig.ADMOB_INTERSTITIAL_ID, new AdRequest.Builder().build(),
            new InterstitialAdLoadCallback() {
                @Override public void onAdLoaded(@NonNull InterstitialAd ad) { interstitial = isForcedAdsRemoved() ? null : ad; interstitialLoading = false; }
                @Override public void onAdFailedToLoad(@NonNull LoadAdError error) { interstitial = null; interstitialLoading = false; }
            });
    }

    /** 게임 결과 화면에서 호출합니다. 빈도 제한을 통과하고 광고가 준비된 경우에만 표시합니다. */
    public void showInterstitial() {
        main.post(() -> {
            if (isForcedAdsRemoved() || activity.isFinishing()) return;
            resultsSinceInterstitial++;
            long now = SystemClock.elapsedRealtime();
            boolean due = resultsSinceInterstitial >= RESULTS_PER_INTERSTITIAL
                && (lastInterstitialAt == 0 || now - lastInterstitialAt >= INTERSTITIAL_MIN_GAP_MS);
            if (!due) return;
            if (interstitial == null) { loadInterstitial(); return; }
            InterstitialAd ad = interstitial;
            interstitial = null;
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override public void onAdDismissedFullScreenContent() { loadInterstitial(); }
                @Override public void onAdFailedToShowFullScreenContent(@NonNull com.google.android.gms.ads.AdError e) { loadInterstitial(); }
            });
            lastInterstitialAt = now;
            resultsSinceInterstitial = 0;
            ad.show(activity);
        });
    }

    // ------------------------------------------------------------------ 보상형 광고(부활 · 힌트)
    // 보상형은 사용자가 직접 '광고 보기'를 눌렀을 때만 표시합니다. 광고 제거 구매자는 광고 없이 바로 보상을 받습니다.
    private void loadRewarded() {
        if (isAdFree() || rewarded != null || rewardedLoading || !adsInitialized) return;
        rewardedLoading = true;
        RewardedAd.load(activity, BuildConfig.ADMOB_REWARDED_ID, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override public void onAdLoaded(@NonNull RewardedAd ad) { rewarded = isAdFree() ? null : ad; rewardedLoading = false; }
            @Override public void onAdFailedToLoad(@NonNull LoadAdError error) { rewarded = null; rewardedLoading = false; }
        });
    }

    /** 결과는 window.onRewardResult(requestId, 'earned'|'closed'|'unavailable') 로 전달합니다. */
    public void showRewarded(final String requestId) {
        main.post(() -> {
            String id = requestId == null ? "" : requestId.replaceAll("[^A-Za-z0-9_-]", "");
            if (isAdFree()) { notifyReward(id, "earned"); return; }
            if (consent == null || !consent.canRequestAds()) { notifyReward(id, "unavailable"); return; }
            if (!adsStarted.get()) startAds();
            if (rewarded == null) { loadRewarded(); notifyReward(id, "unavailable"); return; }
            RewardedAd ad = rewarded;
            rewarded = null;
            final boolean[] earned = {false};
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override public void onAdDismissedFullScreenContent() { notifyReward(id, earned[0] ? "earned" : "closed"); loadRewarded(); }
                @Override public void onAdFailedToShowFullScreenContent(@NonNull com.google.android.gms.ads.AdError e) { notifyReward(id, "unavailable"); loadRewarded(); }
            });
            ad.show(activity, reward -> earned[0] = true);
        });
    }

    public boolean isRewardedReady() { return isAdFree() || rewarded != null; }

    private void notifyReward(String id, String status) {
        main.post(() -> webView.evaluateJavascript("window.onRewardResult&&window.onRewardResult('" + id + "','" + status + "')", null));
    }

    public boolean isPrivacyOptionsRequired() {
        return consent != null && consent.getPrivacyOptionsRequirementStatus()
            == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }

    public void showPrivacyOptions() {
        main.post(() -> UserMessagingPlatform.showPrivacyOptionsForm(activity, e -> {
            if (consent != null && consent.canRequestAds()) startAds();
        }));
    }

    /** v2.0.2: Google Play 계정의 국가(ISO 3166-1 alpha-2, 예: KR). 4초 안에 답이 없으면 빈 문자열. */
    public void queryCountry(java.util.function.Consumer<String> cb) {
        final java.util.concurrent.atomic.AtomicBoolean done = new java.util.concurrent.atomic.AtomicBoolean(false);
        final java.util.function.Consumer<String> once = v -> { if (done.compareAndSet(false, true)) main.post(() -> cb.accept(v == null ? "" : v.trim().toUpperCase(java.util.Locale.ROOT))); };
        main.postDelayed(() -> once.accept(""), 4000);
        if (billing == null) { once.accept(""); return; }
        main.post(() -> connectBilling(() -> {
            try {
                billing.getBillingConfigAsync(com.android.billingclient.api.GetBillingConfigParams.newBuilder().build(),
                    (result, config) -> once.accept(result.getResponseCode() == BillingClient.BillingResponseCode.OK && config != null ? config.getCountryCode() : ""));
            } catch (Exception e) { once.accept(""); }
        }));
    }

    // ------------------------------------------------------------------ 결제
    private void startBilling() {
        billing = BillingClient.newBuilder(activity)
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build();
        connectBilling(null);
    }

    private void connectBilling(Runnable then) {
        if (billing.isReady()) { if(then!=null) then.run(); return; }
        if(then!=null) connectionWaiters.add(then);
        if(connecting) return;
        connecting=true;
        billing.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(@NonNull BillingResult result) {
                main.post(()->{
                    connecting=false;
                    java.util.List<Runnable> waiting=new java.util.ArrayList<>(connectionWaiters);
                    connectionWaiters.clear();
                    if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK) {
                        purchasing=false; billingCode=result.getResponseCode(); billingDebug=result.getDebugMessage();
                        notifyJs(); notifyPurchase("unavailable"); return;
                    }
                    queryProduct(null);
                    if(waiting.isEmpty()) queryOwned(false);
                    else for(Runnable r:waiting) r.run();
                });
            }
            @Override public void onBillingServiceDisconnected() {
                // 연결이 끊기면 잠시 뒤 다시 연결합니다(내부 테스트 첫 실행 시 Play 스토어 서비스가 늦게 뜨는 경우 포함).
                main.postDelayed(()->{ connecting=false; if(!activity.isFinishing()) connectBilling(null); }, 3000);
            }
        });
    }

    private void queryProduct(Runnable after) {
        java.util.List<QueryProductDetailsParams.Product> list=new java.util.ArrayList<>();
        for(String id:new String[]{AdEntitlement.BASIC,AdEntitlement.FULL,AdEntitlement.UPGRADE})
            list.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.INAPP).build());
        billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(list).build(),(result,details)->main.post(()->{
            products.clear();
            billingCode=result.getResponseCode();
            billingDebug=result.getDebugMessage()==null?"":result.getDebugMessage();
            java.util.List<String> missing=new java.util.ArrayList<>();
            if(result.getResponseCode()==BillingClient.BillingResponseCode.OK) {
                for(ProductDetails d:details.getProductDetailsList()) products.put(d.getProductId(),d);
                for(String id:new String[]{AdEntitlement.BASIC,AdEntitlement.FULL,AdEntitlement.UPGRADE}) if(!products.containsKey(id)) missing.add(id);
            }
            missingProducts=String.join(",",missing);
            android.util.Log.i("SumdokuBilling","products code="+billingCode+" found="+products.keySet()+" missing="+missingProducts+" debug="+billingDebug);
            notifyJs();
            // 일시 오류면 몇 번 더 시도합니다.
            boolean transient_=billingCode==BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE||billingCode==BillingClient.BillingResponseCode.NETWORK_ERROR||billingCode==BillingClient.BillingResponseCode.ERROR;
            if(transient_ && productRetry<3 && after==null) { productRetry++; main.postDelayed(()->{ if(billing.isReady()) queryProduct(null); }, 4000L*productRetry); }
            else if(billingCode==BillingClient.BillingResponseCode.OK) productRetry=0;
            if(after!=null) after.run();
        }));
    }

    private void queryOwned(boolean userRequested) { queryOwned(userRequested,null); }
    private void queryOwned(boolean userRequested,Runnable after) {
        final int generation=++ownedGeneration;
        billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),(result,purchases)->main.post(()->{
            if(generation!=ownedGeneration) { if(after!=null) {purchasing=false;notifyPurchase("unavailable");} return; }
            if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK) {
                purchasing=false;
                if(userRequested || after!=null) notifyPurchase("error");
                return; // Offline/error never revokes cached purchases.
            }
            java.util.Set<String> owned=new java.util.HashSet<>();
            for(Purchase p:purchases) {
                if(p.getPurchaseState()!=Purchase.PurchaseState.PURCHASED) continue;
                owned.addAll(p.getProducts());
                if(!p.isAcknowledged() && p.getProducts().stream().anyMatch(id->AdEntitlement.BASIC.equals(id)||AdEntitlement.FULL.equals(id)||AdEntitlement.UPGRADE.equals(id)))
                    billing.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(),r->{
                        // Failed acknowledgement is retried by the next purchase query / resume.
                    });
            }
            setTier(AdEntitlement.tier(owned));
            if(userRequested) notifyPurchase(getAdTier()>0 ? "restored" : "none");
            if(after!=null) after.run();
        }));
    }

    private String price(String id) {
        ProductDetails d=products.get(id);
        return d==null || d.getOneTimePurchaseOfferDetails()==null ? "" : d.getOneTimePurchaseOfferDetails().getFormattedPrice();
    }
    public String getRemoveAdsPrice() { return price(AdEntitlement.FULL); }
    public String getMonetizationState() {
        org.json.JSONObject state=new org.json.JSONObject();
        try {
            state.put("tier",getAdTier()); state.put("basicPrice",price(AdEntitlement.BASIC));
            state.put("fullPrice",price(AdEntitlement.FULL)); state.put("upgradePrice",price(AdEntitlement.UPGRADE));
            state.put("privacy",isPrivacyOptionsRequired());
            state.put("billingCode",billingCode); state.put("billingDebug",billingDebug); state.put("missing",missingProducts);
        }catch(org.json.JSONException ignored){}
        return state.toString();
    }
    public void purchaseRemoveAds() { purchaseAdProduct(getAdTier()==1?AdEntitlement.UPGRADE:AdEntitlement.FULL); }
    public void purchaseAdProduct(String id) {
        main.post(()->{
            if(purchasing)return;
            if(!AdEntitlement.canBuy(id,getAdTier())) {notifyPurchase("owned");return;}
            purchasing=true;
            connectBilling(()->queryOwned(false,()->{
                if(!AdEntitlement.canBuy(id,getAdTier())) {purchasing=false;notifyPurchase("owned");return;}
                queryProduct(()->{
                    ProductDetails d=products.get(id);
                    if(d==null || d.getOneTimePurchaseOfferDetails()==null) {purchasing=false;notifyPurchase("unavailable");return;}
                    BillingFlowParams.ProductDetailsParams.Builder item=BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d);
                    String token=d.getOneTimePurchaseOfferDetails().getOfferToken();
                    if(token!=null && !token.isEmpty())item.setOfferToken(token);
                    BillingResult result=billing.launchBillingFlow(activity,BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(item.build())).build());
                    if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK) {
                        purchasing=false;
                        if(result.getResponseCode()==BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED)queryOwned(true);
                        else notifyPurchase("error");
                    }
                });
            }));
        });
    }
    public void restorePurchases() { main.post(()->connectBilling(()->queryOwned(true))); }
    /** 가격 다시 불러오기(설정 화면의 '다시 시도'). */
    public void refreshProducts() { main.post(()->{ productRetry=0; connectBilling(()->queryProduct(null)); }); }
    @Override public void onPurchasesUpdated(@NonNull BillingResult result,List<Purchase> purchases) {
        main.post(()->{
            purchasing=false;
            int code=result.getResponseCode();
            if(code==BillingClient.BillingResponseCode.OK && purchases!=null) {
                boolean completed=purchases.stream().anyMatch(p->p.getPurchaseState()==Purchase.PurchaseState.PURCHASED);
                if(completed) queryOwned(false,()->notifyPurchase("purchased"));
                else notifyPurchase("pending");
            }else if(code==BillingClient.BillingResponseCode.USER_CANCELED) notifyPurchase("canceled");
            else if(code==BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) queryOwned(true);
            else notifyPurchase("error");
        });
    }
    private void setTier(int tier) {
        prefs.edit().putInt("ad_tier",tier).putBoolean(KEY_AD_FREE,tier==2).apply();
        if(isForcedAdsRemoved()) {removeBanner();interstitial=null;}
        if(isAdFree()) rewarded=null;
        else if(consent!=null && consent.canRequestAds()) {
            startAds();
            if(adsInitialized) {loadBanner();loadInterstitial();loadRewarded();}
        }
        notifyJs();
    }
    private void notifyJs() {
        main.post(()->webView.evaluateJavascript("window.onMonetizationChanged&&window.onMonetizationChanged("+getMonetizationState()+")",null));
    }

    private void notifyPurchase(String status) {
        main.post(() -> webView.evaluateJavascript("window.onPurchaseResult&&window.onPurchaseResult('" + status + "')", null));
    }

    public void onResume() {
        if (banner != null) banner.resume();
        // 다른 기기에서 구매했거나 대기 결제가 완료된 경우를 반영합니다.
        if (billing != null && billing.isReady() && !purchasing) { queryOwned(false); queryProduct(null); }
    }

    public void onPause() { if (banner != null) banner.pause(); }

    public void onDestroy() {
        if (banner != null) banner.destroy();
        if (billing != null) billing.endConnection();
    }
}
