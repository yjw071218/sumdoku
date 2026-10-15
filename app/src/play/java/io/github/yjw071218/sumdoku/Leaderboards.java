package io.github.yjw071218.sumdoku;
import android.app.Activity;
import android.webkit.WebView;
import com.google.android.gms.games.PlayGames;
import org.json.JSONObject;
/* v1.1.19 · Google Play 게임즈 리더보드
 * 리더보드 ID는 Play Console에서 만든 뒤 gradle 속성(sumdoku.games.lb.*)으로 넣습니다.
 * 점수 제출은 이미 로그인된 경우에만 조용히 보내고(로그인 창을 띄우지 않음), 보기 버튼은 필요하면 로그인합니다. */
public class Leaderboards {
 private final Activity activity; private final WebView web;
 private static final int SHOW=7843;
 public Leaderboards(Activity a, WebView w) { activity=a; web=w; }
 private static String id(String key) {
  for (String pair : BuildConfig.LEADERBOARDS.split(";")) { int k=pair.indexOf('='); if(k>0 && pair.substring(0,k).equals(key)) return pair.substring(k+1); }
  return "";
 }
 public boolean isConfigured(String key) { return BuildConfig.GAMES_CONFIGURED && !id(key).isEmpty(); }
 private void emit(String status,String key) { activity.runOnUiThread(()->web.evaluateJavascript("window.onLeaderboardResult&&window.onLeaderboardResult("+JSONObject.quote(status)+","+JSONObject.quote(key)+")",null)); }
 public void submit(String key,long score) { activity.runOnUiThread(()->{
  String lb=id(key); if(!BuildConfig.GAMES_CONFIGURED || lb.isEmpty() || score<0) return;
  PlayGames.getGamesSignInClient(activity).isAuthenticated().addOnSuccessListener(r->{
   if(r.isAuthenticated()) PlayGames.getLeaderboardsClient(activity).submitScore(lb,score);
  });
 }); }
 public void show(String key) { activity.runOnUiThread(()->{
  if(!BuildConfig.GAMES_CONFIGURED){emit("unconfigured",key);return;}
  String lb=key.isEmpty()?"":id(key);
  if(!key.isEmpty() && lb.isEmpty()){emit("unconfigured",key);return;}
  PlayGames.getGamesSignInClient(activity).signIn().addOnSuccessListener(r->{
   if(!r.isAuthenticated()){emit("signin_failed",key);return;}
   (lb.isEmpty()?PlayGames.getLeaderboardsClient(activity).getAllLeaderboardsIntent():PlayGames.getLeaderboardsClient(activity).getLeaderboardIntent(lb))
    .addOnSuccessListener(i->{activity.startActivityForResult(i,SHOW);emit("shown",key);})
    .addOnFailureListener(e->emit("error",key));
  }).addOnFailureListener(e->emit("signin_failed",key));
 }); }
}
