package com.callofsurvival.game;

import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;

/**
 * Updates without a new APK. The game in the app carries game/version.json: its version and every file with a short
 * SHA-1. At each start the app reads the newest version.json from the game's GitHub repository; when it is newer, the
 * player is asked, and only the files that changed are downloaded (from the tag of that version), checked, and kept in
 * the app's own storage, where they are served before the files inside the APK. A newer APK (one that carries a newer
 * version than the downloads) clears them. Content that needs newer app code ("shell") asks for the new APK instead.
 */
public class Updater {
    final MainActivity act;
    final File dir, stage;
    JSONObject bundled, applied;
    volatile boolean busy;

    Updater(MainActivity a) {
        act = a;
        dir = new File(a.getFilesDir(), "game");
        stage = new File(a.getFilesDir(), "stage");
    }

    static String raw(String ref, String path) {
        StringBuilder b = new StringBuilder("https://raw.githubusercontent.com/").append(BuildConfig.REPO).append('/').append(ref).append("/game");
        for (String seg : path.split("/")) b.append('/').append(Uri.encode(seg));
        return b.toString();
    }

    static String apkUrl() {
        // the small one: it installs on every phone (the game itself comes in its updates, kept as it is)
        return "https://github.com/" + BuildConfig.REPO + "/releases/latest/download/CallOfSurvival-lite.apk";
    }

    /** at the start: what is inside the app, what was downloaded, and which of the two is newer */
    void prepare() {
        bundled = readJson(assetStream("game/version.json"));
        File rec = new File(dir, "version.json");
        try { applied = rec.isFile() ? readJson(new FileInputStream(rec)) : null; } catch (IOException e) { applied = null; }
        if (applied == null || version(applied) <= version(bundled)) {
            wipe(dir);           // the app itself holds this version or a newer one
            applied = null;
        }
        wipe(stage);             // an update cut off half way
    }

    static int version(JSONObject m) {
        return m == null ? 0 : m.optInt("v", 0);
    }

    int current() {
        return Math.max(version(bundled), version(applied));
    }

    /** a file of the game: the downloaded one, or the one inside the app */
    InputStream open(String p) {
        if (applied != null) {
            File f = new File(dir, p);
            if (f.isFile()) {
                try { return new FileInputStream(f); } catch (IOException e) { /* fall back */ }
            }
        }
        return assetStream("game/" + p);
    }

    private InputStream assetStream(String p) {
        try { return act.getAssets().open(p); } catch (IOException e) { return null; }
    }

    /** the hash of the file the game uses now */
    private String have(String p) {
        JSONObject m = applied != null && new File(dir, p).isFile() ? applied : bundled;
        JSONObject files = m == null ? null : m.optJSONObject("files");
        JSONArray e = files == null ? null : files.optJSONArray(p);
        return e == null ? "" : e.optString(0);
    }

    // ── is there a newer version? ──
    void check() {
        if (busy) return;
        busy = true;
        new Thread(() -> {
            JSONObject remote = null;
            try {
                String url = raw("main", "version.json") + "?t=" + (System.currentTimeMillis() / 60000);
                remote = new JSONObject(new String(get(url), StandardCharsets.UTF_8));
            } catch (Exception e) { /* no connection: play what we have */ }
            final JSONObject r = remote;
            act.runOnUiThread(() -> {
                busy = false;
                if (r != null && !act.isFinishing()) offer(r);
            });
        }).start();
    }

    /** the small APK, opened the first time: the whole game is downloaded (its size said first) */
    void firstRun() {
        if (busy) return;
        busy = true;
        new Thread(() -> {
            JSONObject remote = null;
            try {
                String url = raw("main", "version.json") + "?t=" + (System.currentTimeMillis() / 60000);
                remote = new JSONObject(new String(get(url), StandardCharsets.UTF_8));
            } catch (Exception e) { /* no connection */ }
            final JSONObject r = remote;
            act.runOnUiThread(() -> {
                busy = false;
                if (act.isFinishing()) return;
                if (r == null || r.optJSONObject("files") == null) { firstFailed(); return; }
                final List<String> all = new ArrayList<>();
                long bytes = 0;
                JSONObject files = r.optJSONObject("files");
                for (Iterator<String> it = files.keys(); it.hasNext(); ) {
                    String p = it.next();
                    JSONArray e = files.optJSONArray(p);
                    if (e == null || p.contains("..")) continue;
                    all.add(p);
                    bytes += e.optLong(1);
                }
                final long total = bytes;
                new AlertDialog.Builder(act, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                        .setTitle("Call of Survival")
                        .setMessage("أهلاً بك. تُنزَّل اللعبة الآن مرة واحدة (" + mb(total) + ")، ثم تعمل بلا إنترنت وتصلها التحديثات من داخلها.")
                        .setCancelable(false)
                        .setPositiveButton("تنزيل", (d, w) -> download(r, all, total, true))
                        .setNegativeButton("خروج", (d, w) -> act.finish())
                        .show();
            });
        }).start();
    }

    private void firstFailed() {
        new AlertDialog.Builder(act, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                .setTitle("تحتاج اتصالاً بالإنترنت")
                .setMessage("تُنزَّل اللعبة مرة واحدة عند أول فتح. اتصل بالإنترنت ثم أعد المحاولة.")
                .setCancelable(false)
                .setPositiveButton("أعد المحاولة", (d, w) -> firstRun())
                .setNegativeButton("خروج", (d, w) -> act.finish())
                .show();
    }

    private void offer(JSONObject remote) {
        final int v = version(remote);
        if (v <= current()) return;
        if (remote.optInt("shell", 1) > BuildConfig.SHELL) {
            new AlertDialog.Builder(act, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                    .setTitle("نسخة جديدة من التطبيق")
                    .setMessage("الإصدار " + ar(v) + " يحتاج نسخة جديدة من التطبيق. نزّلها وثبّتها فوق هذه، وتبقى محفوظاتك كما هي.")
                    .setPositiveButton("تنزيل", (d, w) -> {
                        try { act.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(apkUrl()))); } catch (Exception e) { /* no browser */ }
                    })
                    .setNegativeButton("لاحقاً", null)
                    .show();
            return;
        }
        final List<String> need = new ArrayList<>();
        long bytes = 0;
        JSONObject files = remote.optJSONObject("files");
        if (files == null) return;
        for (Iterator<String> it = files.keys(); it.hasNext(); ) {
            String p = it.next();
            JSONArray e = files.optJSONArray(p);
            if (e == null || p.contains("..")) continue;
            if (!e.optString(0).equals(have(p))) {
                need.add(p);
                bytes += e.optLong(1);
            }
        }
        final long total = bytes;
        String size = need.isEmpty() ? "" : " (" + mb(total) + " للتنزيل)";
        new AlertDialog.Builder(act, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                .setTitle("تحديث جديد للعبة")
                .setMessage("الإصدار " + ar(v) + " جاهز" + size + ". تحديث الآن؟")
                .setPositiveButton("تحديث", (d, w) -> download(remote, need, total, false))
                .setNegativeButton("لاحقاً", null)
                .show();
    }

    // ── the changed files, checked, then put in place together ──
    private void download(final JSONObject remote, final List<String> need, final long total, final boolean first) {
        if (busy) return;
        busy = true;
        final Progress pr = new Progress(total, first ? "تنزيل اللعبة" : "تحديث اللعبة");
        final String ref = remote.optString("ref", "main");
        new Thread(() -> {
            String err = null;
            try {
                wipe(stage);
                JSONObject files = remote.getJSONObject("files");
                byte[] buf = new byte[1 << 16];
                long done = 0;
                for (String p : need) {
                    File out = new File(stage, p);
                    File parent = out.getParentFile();
                    if (parent != null) parent.mkdirs();
                    MessageDigest md = MessageDigest.getInstance("SHA-1");
                    HttpURLConnection c = connect(raw(ref, p));
                    try (InputStream in = c.getInputStream(); OutputStream os = new FileOutputStream(out)) {
                        int n;
                        while ((n = in.read(buf)) > 0) {
                            os.write(buf, 0, n);
                            md.update(buf, 0, n);
                            done += n;
                            pr.set(done);
                        }
                    } finally {
                        c.disconnect();
                    }
                    String want = files.getJSONArray(p).getString(0);
                    if (!hex(md.digest()).startsWith(want)) throw new IOException("checksum " + p);
                }
                for (String p : need) {
                    File src = new File(stage, p), dst = new File(dir, p);
                    File parent = dst.getParentFile();
                    if (parent != null) parent.mkdirs();
                    if (dst.exists() && !dst.delete()) throw new IOException("cannot replace " + p);
                    if (!src.renameTo(dst)) copy(src, dst);
                }
                dir.mkdirs();
                try (OutputStream os = new FileOutputStream(new File(dir, "version.json"))) {
                    os.write(remote.toString().getBytes(StandardCharsets.UTF_8));
                }
                wipe(stage);
            } catch (Exception e) {
                err = String.valueOf(e.getMessage());
            }
            final String fail = err;
            act.runOnUiThread(() -> {
                busy = false;
                pr.close();
                if (fail == null) {
                    applied = remote;
                    act.reloadGame();
                    Toast.makeText(act, first ? "اللعبة جاهزة" : "تم التحديث إلى الإصدار " + ar(version(remote)), Toast.LENGTH_LONG).show();
                } else if (first) {
                    wipe(stage);
                    firstFailed();
                } else {
                    wipe(stage);
                    new AlertDialog.Builder(act, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                            .setTitle("تعذّر التحديث")
                            .setMessage("تحقّق من الاتصال وافتح اللعبة مرة أخرى لتعيد المحاولة.")
                            .setPositiveButton("حسناً", null)
                            .show();
                }
            });
        }).start();
    }

    /** the bar while it downloads */
    private class Progress {
        final AlertDialog dlg;
        final ProgressBar bar;
        final TextView txt;
        final long total;
        long last;

        Progress(long total, String title) {
            this.total = total;
            LinearLayout box = new LinearLayout(act);
            box.setOrientation(LinearLayout.VERTICAL);
            int pad = (int) (22 * act.getResources().getDisplayMetrics().density);
            box.setPadding(pad, pad / 2, pad, pad / 2);
            txt = new TextView(act);
            txt.setText("جارٍ التنزيل…");
            txt.setTextSize(15);
            bar = new ProgressBar(act, null, android.R.attr.progressBarStyleHorizontal);
            bar.setMax(1000);
            box.addView(txt);
            box.addView(bar);
            dlg = new AlertDialog.Builder(act, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                    .setTitle(title)
                    .setView(box)
                    .setCancelable(false)
                    .create();
            dlg.show();
        }

        void set(final long done) {
            long now = System.currentTimeMillis();
            if (now - last < 150) return;
            last = now;
            act.runOnUiThread(() -> {
                bar.setProgress((int) (total > 0 ? Math.min(1000, done * 1000 / total) : 0));
                txt.setText("جارٍ التنزيل… " + mb(done) + " من " + mb(total));
            });
        }

        void close() {
            try { dlg.dismiss(); } catch (Exception e) { /* already gone */ }
        }
    }

    // ── small helpers ──
    static HttpURLConnection connect(String url) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("Cache-Control", "no-cache");
        if (c.getResponseCode() != 200) {
            int code = c.getResponseCode();
            c.disconnect();
            throw new IOException("HTTP " + code + " " + url);
        }
        return c;
    }

    static byte[] get(String url) throws IOException {
        HttpURLConnection c = connect(url);
        try (InputStream in = c.getInputStream()) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[1 << 14];
            int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
            return b.toByteArray();
        } finally {
            c.disconnect();
        }
    }

    static JSONObject readJson(InputStream in) {
        if (in == null) return null;
        try (InputStream s = in) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[1 << 14];
            int n;
            while ((n = s.read(buf)) > 0) b.write(buf, 0, n);
            return new JSONObject(new String(b.toByteArray(), StandardCharsets.UTF_8));
        } catch (Exception e) {
            return null;
        }
    }

    static void copy(File a, File b) throws IOException {
        try (InputStream in = new FileInputStream(a); OutputStream out = new FileOutputStream(b)) {
            byte[] buf = new byte[1 << 16];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        }
    }

    static void wipe(File f) {
        if (f == null || !f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) wipe(k);
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }

    static String hex(byte[] d) {
        StringBuilder s = new StringBuilder();
        for (byte x : d) s.append(String.format(Locale.ROOT, "%02x", x));
        return s.toString();
    }

    static String ar(long n) {
        return String.format(new Locale("ar"), "%d", n);
    }

    static String mb(long bytes) {
        double m = bytes / 1048576.0;
        return m < 1 ? "أقل من ١ م.ب" : String.format(new Locale("ar"), "%.1f م.ب", m);
    }
}
