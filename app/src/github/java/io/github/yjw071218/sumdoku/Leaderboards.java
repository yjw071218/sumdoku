package io.github.yjw071218.sumdoku;
/* GitHub 배포판에는 Google Play 게임즈가 없으므로 리더보드를 쓰지 않습니다. */
public class Leaderboards {
 public Leaderboards(android.app.Activity a, android.webkit.WebView w) {}
 public boolean isConfigured(String key) { return false; }
 public void submit(String key, long score) {}
 public void show(String key) {}
 public void load(String key, int max, boolean interactive) {}
}
