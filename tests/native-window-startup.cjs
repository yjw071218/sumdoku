// 실제 Android 실행 검사가 아닌, PhoneWindow의 DecorView 생성 전 접근을 재현하는 Java 회귀 검사.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const dir=path.resolve('build/window-startup-test');
fs.mkdirSync(dir,{recursive:true});
const write=(name,source)=>{const p=path.join(dir,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,source);return p;};
const current=fs.readFileSync('app/src/main/java/io/github/yjw071218/sumdoku/MainActivity.java','utf8');
const previous=execFileSync('git',['show','v1.1.8:app/src/main/java/io/github/yjw071218/sumdoku/MainActivity.java'],{encoding:'utf8'});
function method(source){const from=source.indexOf('private void applyImmersive()');let depth=0,end=source.indexOf('{',from);for(let i=end;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&!--depth)return source.slice(from,i+1);}throw Error('method missing');}
const create=current.slice(current.indexOf('protected void onCreate('),current.indexOf('private String getApkVersionName'));
assert.ok(create.indexOf('setContentView(rootLayout)')<create.indexOf('applyImmersive()'),'content must exist before fullscreen setup');
const files=[
 write('android/view/View.java',`package android.view; public class View { public static final int SYSTEM_UI_FLAG_LAYOUT_STABLE=1,SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN=2,SYSTEM_UI_FLAG_FULLSCREEN=4,SYSTEM_UI_FLAG_IMMERSIVE_STICKY=8; public WindowInsetsController controller=new WindowInsetsController(); public int flags; public void setSystemUiVisibility(int value){flags=value;} }`),
 write('android/view/WindowInsetsController.java',`package android.view; public class WindowInsetsController {public static final int BEHAVIOR_DEFAULT=1;public boolean hidden;public void setSystemBarsBehavior(int b){}public void hide(int t){hidden=true;}}`),
 write('android/view/WindowInsets.java',`package android.view; public class WindowInsets {public static class Type {public static int statusBars(){return 1;}}}`),
 write('WindowManager.java',`class WindowManager {static class LayoutParams {static final int FLAG_FULLSCREEN=1;}}`),
 write('Build.java',`class Build {static class VERSION {static int SDK_INT=35;}static class VERSION_CODES {static final int R=30;}}`),
 write('TestWindow.java',`class TestWindow {android.view.View decor;android.view.View getDecorView(){if(decor==null)decor=new android.view.View();return decor;}void addFlags(int f){}void setDecorFitsSystemWindows(boolean fits){}android.view.WindowInsetsController getInsetsController(){return decor.controller;}}`),
 ...[['Previous',previous],['Fixed',current]].map(([name,source])=>write(name+'.java',`class ${name} {TestWindow window=new TestWindow();TestWindow getWindow(){return window;}${method(source)}void run(){applyImmersive();}}`)),
 write('StartupSmoke.java',`public class StartupSmoke {public static void main(String[] args){boolean crashed=false;try{new Previous().run();}catch(NullPointerException expected){crashed=true;}if(!crashed)throw new AssertionError("old startup must reproduce crash");for(int api:new int[]{26,30,31,35}){Build.VERSION.SDK_INT=api;Fixed fixed=new Fixed();fixed.run();fixed.run();if(fixed.window.decor==null)throw new AssertionError();if(api>=30&&!fixed.window.decor.controller.hidden)throw new AssertionError();}Build.VERSION.SDK_INT=35;Fixed detached=new Fixed();detached.window.getDecorView().controller=null;detached.run();System.out.println("PASS: v1.1.8 null-decor crash reproduced; fixed cold/repeated startup on API branches 26/30/31/35 and null controller");}}`)
];
const bin=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin'):'';
execFileSync(bin?path.join(bin,'javac.exe'):'javac',['-d',dir,...files],{stdio:'inherit'});
execFileSync(bin?path.join(bin,'java.exe'):'java',['-cp',dir,'StartupSmoke'],{stdio:'inherit'});
