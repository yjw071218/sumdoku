import io.github.yjw071218.sumdoku.BattleServer;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;

public class BattleServerSmoke {
    static String request(String path, String body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL("http://127.0.0.1:18888/api/" + path).openConnection();
        connection.setConnectTimeout(2000);
        connection.setReadTimeout(2000);
        if (body != null) {
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (var out = connection.getOutputStream()) { out.write(bytes); }
        }
        if (connection.getResponseCode() != 200) throw new AssertionError("HTTP error");
        try (var in = connection.getInputStream()) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            in.transferTo(bytes);
            return bytes.toString(StandardCharsets.UTF_8);
        } finally { connection.disconnect(); }
    }
    static void require(boolean ok, String message) { if (!ok) throw new AssertionError(message); }
    public static void main(String[] args) throws Exception {
        BattleServer server = new BattleServer();
        try {
            if (args.length > 0 && "--serve".equals(args[0])) {
                require(server.start(18888), "bind network test server");
                System.out.println("READY");
                System.in.read();
                return;
            }
            for (int i = 0; i < 3; i++) {
                server.configureRoom("race", "easy", 0, "{\"rules\":{\"maxLives\":\"5\",\"initialHints\":\"0\"}}");
                require(server.start(18888), "bind");
                require(request("status", null).contains("\"guestJoined\":false"), "clean lobby");
                request("join", "{\"name\":\"게스트\"}");
                require(request("status", null).contains("\"guestJoined\":true"), "join");
                require(request("room", null).contains("\"maxLives\":\"5\""), "shared rules");
                request("ready", "{\"player\":2,\"ready\":true}");
                request("start", "{\"solution\":[],\"cages\":[]}");
                require(request("room", null).contains("playing"), "start");
                request("progress", "{\"player\":2,\"name\":\"한글 이름\",\"score\":123}");
                require(request("progress", null).contains("한글 이름"), "UTF-8 byte length");
                int resigning = i % 2 + 1;
                String result = request("end", "{ \"player\": " + resigning + ", \"forfeit\": true, \"score\":123 }");
                require(result.contains("\"endedBy\":" + resigning), "forfeit actor");
                require(request("room", null).contains("ended"), "end");
                request("progress", "{\"player\":" + resigning + ",\"score\":0,\"forfeit\":false}");
                require(request("progress", null).equals(result), "late progress cannot overwrite terminal snapshot");
                request("end", "{\"player\":" + (3-resigning) + ",\"forfeit\":true}");
                require(request("progress", null).equals(result), "first terminal request wins");
                request("rematch", "{}");
                require(request("status", null).contains("waiting"), "rematch lobby");
                require(request("progress", null).equals(result), "slow peer can still read previous result");
                request("ready", "{\"player\":2,\"ready\":true}");
                request("start", "{\"solution\":[],\"cages\":[]}");
                require(request("progress", null).contains("\"status\":\"playing\""), "new match resets result");
                final int first=i%2+1;
                Thread a=new Thread(()->{try{request("end", "{\"player\":"+first+",\"forfeit\":true}");}catch(Exception e){throw new RuntimeException(e);}});
                Thread b=new Thread(()->{try{request("end", "{\"player\":"+(3-first)+",\"forfeit\":true}");}catch(Exception e){throw new RuntimeException(e);}});
                a.start();b.start();a.join();b.join();
                String concurrent=request("progress",null);
                require(concurrent.contains("\"status\":\"ended\""),"simultaneous forfeit terminates");
                require(concurrent.equals(request("progress",null)),"terminal read is stable");
                server.stop();
            }
            System.out.println("PASS: join, shared rules, UTF-8, both roles forfeit, late progress, simultaneous forfeit, rematch retention, three restarts");
        } finally { server.stop(); }
    }
}
