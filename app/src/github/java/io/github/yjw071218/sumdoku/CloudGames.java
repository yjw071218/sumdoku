package io.github.yjw071218.sumdoku;
public class CloudGames {
 public CloudGames(android.app.Activity a, android.webkit.WebView w) {}
 /** GitHub판에는 Play 게임즈가 없습니다. */
 public void player(boolean interactive, java.util.function.Consumer<String> cb) { cb.accept("{\"signedIn\":false,\"reason\":\"unavailable\"}"); }
 public void signIn() {} public void save(String data) {} public void load() {}
 public boolean result(int request, int result, android.content.Intent data) { return false; }
}
