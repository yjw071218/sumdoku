package io.github.yjw071218.sumdoku;
import android.app.Activity;
import android.content.Intent;
import android.webkit.WebView;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.SnapshotsClient;
import com.google.android.gms.games.snapshot.Snapshot;
import com.google.android.gms.games.snapshot.SnapshotMetadata;
import com.google.android.gms.games.snapshot.SnapshotMetadataChange;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
public class CloudGames {
 private final Activity activity; private final WebView web; private boolean busy;
 private static final int PICK=7842;
 public CloudGames(Activity a, WebView w) { activity=a; web=w; }
 private void emit(String status,String data) { activity.runOnUiThread(()->web.evaluateJavascript("window.onCloudResult&&window.onCloudResult("+JSONObject.quote(status)+","+JSONObject.quote(data)+")",null)); }
 private void fail() { busy=false; emit("error",""); }
 // v1.1.30: 실패 원인 코드(ApiException 상태 코드)를 함께 전달해 내부 테스트에서 원인을 바로 알 수 있게 합니다.
 //   10 = DEVELOPER_ERROR(OAuth 클라이언트 SHA-1 불일치·테스터 미등록) · 4 = SIGN_IN_REQUIRED · 7 = NETWORK_ERROR · 16 = CANCELED
 private void fail(Exception e) {
  busy=false;
  int code=-1;
  if(e instanceof com.google.android.gms.common.api.ApiException) code=((com.google.android.gms.common.api.ApiException)e).getStatusCode();
  android.util.Log.w("SumdokuGames","Play Games failed code="+code,e);
  emit("error",String.valueOf(code));
 }
 private void auth(Runnable next) {
  if(!BuildConfig.GAMES_CONFIGURED) { emit("unconfigured",""); return; }
  if(busy) return; busy=true;
  com.google.android.gms.games.GamesSignInClient client=PlayGames.getGamesSignInClient(activity);
  // 이미 자동 로그인된 경우 로그인 창 없이 바로 진행합니다.
  client.isAuthenticated().addOnCompleteListener(t->{
   if(t.isSuccessful() && t.getResult()!=null && t.getResult().isAuthenticated()) { next.run(); return; }
   client.signIn().addOnSuccessListener(r->{
    if(r.isAuthenticated()) next.run(); else { busy=false; emit("error","4"); }
   }).addOnFailureListener(this::fail);
  });
 }
 public void signIn() { activity.runOnUiThread(()->auth(()->{busy=false; emit("signed_in","");})); }
 public void save(String data) { activity.runOnUiThread(()->{
  byte[] bytes=data.getBytes(StandardCharsets.UTF_8);
  if(bytes.length>2800000) { emit("too_large",""); return; }
  auth(()->{
   SnapshotsClient client=PlayGames.getSnapshotsClient(activity);
   // Separate immutable backup per save: never silently replace another device's progress.
   client.open("sumdoku_"+java.util.UUID.randomUUID(),true,SnapshotsClient.RESOLUTION_POLICY_MANUAL)
    .addOnSuccessListener(r->{
     if(r.isConflict() || r.getData()==null) {fail();return;}
     Snapshot snap=r.getData();
     if(!snap.getSnapshotContents().writeBytes(bytes)) {client.discardAndClose(snap);fail();return;}
     client.commitAndClose(snap,new SnapshotMetadataChange.Builder().setDescription("Sumdoku · "+new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm",java.util.Locale.getDefault()).format(new java.util.Date())).build())
      .addOnSuccessListener(m->{busy=false;emit("saved","");}).addOnFailureListener(e->fail());
    }).addOnFailureListener(e->fail());
  });
 }); }
 public void load() { activity.runOnUiThread(()->auth(()->PlayGames.getSnapshotsClient(activity)
  .getSelectSnapshotIntent("Sumdoku",false,true,100).addOnSuccessListener(i->activity.startActivityForResult(i,PICK)).addOnFailureListener(e->fail()))); }
 public boolean result(int request,int result,Intent data) {
  if(request!=PICK)return false;
  if(result!=Activity.RESULT_OK || data==null) {busy=false;emit("canceled","");return true;}
  SnapshotMetadata meta=data.getParcelableExtra(SnapshotsClient.EXTRA_SNAPSHOT_METADATA);
  if(meta==null){fail();return true;}
  SnapshotsClient client=PlayGames.getSnapshotsClient(activity);
  client.open(meta,SnapshotsClient.RESOLUTION_POLICY_MANUAL).addOnSuccessListener(r->{
   if(r.isConflict() || r.getData()==null){fail();return;}
   Snapshot snap=r.getData();
   try {byte[] bytes=snap.getSnapshotContents().readFully();if(bytes.length>2800000)throw new Exception(); emit("loaded",new String(bytes,StandardCharsets.UTF_8));busy=false;}
   catch(Exception e){fail();}finally{client.discardAndClose(snap);}
  }).addOnFailureListener(e->fail());return true;
 }
}
