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
            for (int i = 0; i < 3; i++) {
                server.configureRoom("race", "easy", 0, "{\"rules\":{\"maxLives\":\"5\",\"initialHints\":\"0\"}}");
                require(server.start(18888), "bind");
                require(request("status", null).contains("\"guestJoined\":false"), "clean lobby");
                request("join", "{\"name\":\"게스트\"}");
                require(request("status", null).contains("\"guestJoined\":true"), "join");
                require(request("room", null).contains("\"maxLives\":\"5\""), "shared rules");
                request("start", "");
                require(request("room", null).contains("playing"), "start");
                request("progress", "{\"player\":2,\"name\":\"한글 이름\",\"score\":123}");
                require(request("progress", null).contains("한글 이름"), "UTF-8 byte length");
                request("end", "");
                require(request("room", null).contains("ended"), "end");
                server.stop();
            }
            System.out.println("PASS: join, shared rules, progress UTF-8, end, three server restarts");
        } finally { server.stop(); }
    }
}
