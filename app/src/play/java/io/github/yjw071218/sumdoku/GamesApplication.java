package io.github.yjw071218.sumdoku;
public class GamesApplication extends android.app.Application {
 @Override public void onCreate() { super.onCreate(); if(BuildConfig.GAMES_CONFIGURED) com.google.android.gms.games.PlayGamesSdk.initialize(this); }
}
