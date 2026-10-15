package io.github.yjw071218.sumdoku;
import java.util.Set;
/** Purchase-state independent policy; pass only PURCHASED product IDs. */
public final class AdEntitlement {
 public static final String BASIC="remove_ads_basic", FULL="remove_ads", UPGRADE="remove_ads_upgrade";
 public static int tier(Set<String> owned) {
  if(owned.contains(FULL) || (owned.contains(BASIC)&&owned.contains(UPGRADE))) return 2;
  return owned.contains(BASIC)?1:0;
 }
 public static boolean canBuy(String id,int tier) {
  return tier==0&&(BASIC.equals(id)||FULL.equals(id)) || tier==1&&UPGRADE.equals(id);
 }
 private AdEntitlement() {}
}
