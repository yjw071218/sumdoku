package io.github.yjw071218.sumdoku;
import android.app.Activity;
import android.webkit.WebView;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.leaderboard.LeaderboardScore;
import com.google.android.gms.games.leaderboard.LeaderboardScoreBuffer;
import com.google.android.gms.games.leaderboard.LeaderboardVariant;
import org.json.JSONArray;
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
 /* v1.1.26 · 랭킹 탭용 순위 불러오기
  * 내 순위(전체 기간·전체 공개)와 상위 max명의 순위를 JSON으로 window.onLeaderboardRanks 에 보냅니다.
  * interactive=false면 로그인 창을 띄우지 않고, 로그인되어 있지 않으면 status "signin_required"를 보냅니다. */
 public void load(String key,int max,boolean interactive) { activity.runOnUiThread(()->{
  String lb=id(key);
  if(!BuildConfig.GAMES_CONFIGURED || lb.isEmpty()){emitRanks(key,"unconfigured",null,null);return;}
  com.google.android.gms.tasks.Task<com.google.android.gms.games.AuthenticationResult> auth = interactive
   ? PlayGames.getGamesSignInClient(activity).signIn()
   : PlayGames.getGamesSignInClient(activity).isAuthenticated();
  auth.addOnSuccessListener(r->{
   if(!r.isAuthenticated()){emitRanks(key,"signin_required",null,null);return;}
   final JSONObject[] me={null};
   PlayGames.getLeaderboardsClient(activity).loadCurrentPlayerLeaderboardScore(lb,LeaderboardVariant.TIME_SPAN_ALL_TIME,LeaderboardVariant.COLLECTION_PUBLIC)
    .addOnCompleteListener(mt->{
     try { LeaderboardScore ms = mt.isSuccessful() && mt.getResult()!=null ? mt.getResult().get() : null; if(ms!=null) me[0]=scoreJson(ms); } catch(Exception ignored) {}
     PlayGames.getLeaderboardsClient(activity).loadTopScores(lb,LeaderboardVariant.TIME_SPAN_ALL_TIME,LeaderboardVariant.COLLECTION_PUBLIC,Math.max(1,Math.min(25,max)))
      .addOnSuccessListener(data->{
       JSONArray top=new JSONArray();
       LeaderboardScoreBuffer buf=null;
       try { buf=data.get()!=null?data.get().getScores():null; if(buf!=null) for(LeaderboardScore sc:buf) top.put(scoreJson(sc)); }
       catch(Exception ignored) {}
       finally { if(buf!=null) buf.release(); }
       emitRanks(key,"ok",me[0],top);
      })
      .addOnFailureListener(e->emitRanks(key,"error",me[0],null));
    });
  }).addOnFailureListener(e->emitRanks(key,interactive?"signin_failed":"signin_required",null,null));
 }); }
 private static JSONObject scoreJson(LeaderboardScore sc) {
  JSONObject o=new JSONObject();
  try {
   o.put("rank",sc.getRank()); o.put("displayRank",sc.getDisplayRank()); o.put("score",sc.getRawScore());
   o.put("name",sc.getScoreHolderDisplayName());
   o.put("playerId",sc.getScoreHolder()!=null?sc.getScoreHolder().getPlayerId():"");
  } catch(Exception ignored) {}
  return o;
 }
 private void emitRanks(String key,String status,JSONObject me,JSONArray top) {
  JSONObject o=new JSONObject();
  try { o.put("key",key); o.put("status",status); if(me!=null) o.put("me",me); if(top!=null) o.put("top",top); } catch(Exception ignored) {}
  String js="window.onLeaderboardRanks&&window.onLeaderboardRanks("+o.toString()+")";
  activity.runOnUiThread(()->web.evaluateJavascript(js,null));
 }
}
