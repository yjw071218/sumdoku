const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');const dir=path.resolve('build/ad-policy-test');fs.mkdirSync(dir,{recursive:true});const test=path.join(dir,'AdPolicyTest.java');
fs.writeFileSync(test,`import java.util.Set; import io.github.yjw071218.sumdoku.AdEntitlement;
public class AdPolicyTest {
 static void check(boolean ok) {if(!ok)throw new AssertionError();}
 public static void main(String[] args){
 String b=AdEntitlement.BASIC,f=AdEntitlement.FULL,u=AdEntitlement.UPGRADE;
 check(AdEntitlement.tier(Set.of())==0);check(AdEntitlement.tier(Set.of(b))==1);
 check(AdEntitlement.tier(Set.of(f))==2);check(AdEntitlement.tier(Set.of(b,u))==2);
 check(AdEntitlement.tier(Set.of(u))==0);check(AdEntitlement.tier(Set.of(b,f,u))==2);
 check(AdEntitlement.canBuy(b,0));check(AdEntitlement.canBuy(f,0));check(!AdEntitlement.canBuy(u,0));
 check(AdEntitlement.canBuy(u,1));check(!AdEntitlement.canBuy(f,1));check(!AdEntitlement.canBuy(b,1));
 for(String id:new String[]{b,f,u,"invalid"})check(!AdEntitlement.canBuy(id,2));
 System.out.println("PASS: tier combinations, legacy full, upgrade prerequisites, refund recomputation, duplicate purchase guards");
 }} `);const bin=path.join(process.env.JAVA_HOME,'bin');execFileSync(path.join(bin,'javac.exe'),['-d',dir,'app/src/main/java/io/github/yjw071218/sumdoku/AdEntitlement.java',test],{stdio:'inherit'});execFileSync(path.join(bin,'java.exe'),['-cp',dir,'AdPolicyTest'],{stdio:'inherit'});
