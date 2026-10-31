package com.callofsurvival.game;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

/**
 * The game's own browser: a site (free3d, Sketchfab, ambientCG, Poly Haven or any other) over the game, with its own
 * sign-ins kept like any browser's. A file downloaded there goes into the app's storage (files/lib/dl) and the game is told
 * («cosAppEvent»), so the editor adds it like an upload. The back button steps back through the pages, then closes it.
 */
public class Browser {
    final MainActivity act;
    final FrameLayout root;
    WebView web;
    TextView title, status;
    ProgressBar bar;
    volatile boolean downloading;

    Browser(MainActivity a, FrameLayout parent) {
        act = a;
        root = new FrameLayout(a);
        root.setBackgroundColor(0xFF0A1016);
        root.setVisibility(View.GONE);
        root.setClickable(true);
        parent.addView(root, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    boolean open() { return root.getVisibility() == View.VISIBLE; }

    void show(String url) {
        if (web == null) build();
        root.setVisibility(View.VISIBLE);
        root.bringToFront();
        web.loadUrl(url);
    }

    void close() {
        root.setVisibility(View.GONE);
        if (web != null) web.onPause();
    }

    /** the back button: a page back, or out of the browser */
    boolean back() {
        if (!open()) return false;
        if (web != null && web.canGoBack()) web.goBack(); else close();
        return true;
    }

    private int dp(float v) { return Math.round(v * act.getResources().getDisplayMetrics().density); }

    private TextView button(String text, View.OnClickListener l) {
        TextView b = new TextView(act);
        b.setText(text);
        b.setTextColor(0xFFFFE2A8);
        b.setTextSize(14);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(14), 0, dp(14), 0);
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dp(10));
        bg.setColor(0x33FFB53D);
        bg.setStroke(dp(1), 0x99FFB53D);
        b.setBackground(bg);
        b.setOnClickListener(l);
        return b;
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void build() {
        LinearLayout col = new LinearLayout(act);
        col.setOrientation(LinearLayout.VERTICAL);
        LinearLayout top = new LinearLayout(act);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setBackgroundColor(0xFF101820);
        top.setPadding(dp(8), dp(6), dp(8), dp(6));
        top.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(38));
        bl.setMarginEnd(dp(6));
        top.addView(button("✕ إلى اللعبة", v -> close()), bl);
        top.addView(button("→ رجوع", v -> { if (web.canGoBack()) web.goBack(); }), bl);
        top.addView(button("↻", v -> web.reload()), bl);
        title = new TextView(act);
        title.setTextColor(0xFFE8EEF2);
        title.setTextSize(13);
        title.setSingleLine(true);
        title.setEllipsize(android.text.TextUtils.TruncateAt.END);
        title.setPadding(dp(8), 0, dp(8), 0);
        top.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        status = new TextView(act);
        status.setTextColor(0xFFFFD76A);
        status.setTextSize(12.5f);
        status.setVisibility(View.GONE);
        top.addView(status, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        col.addView(top, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        bar = new ProgressBar(act, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(100);
        col.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));
        web = new WebView(act);
        web.setBackgroundColor(Color.WHITE);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setAllowFileAccess(false);
        s.setSupportMultipleWindows(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                String sch = req.getUrl().getScheme();
                return !("http".equals(sch) || "https".equals(sch));       // other kinds of links (apps, mail) are not followed
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int p) {
                bar.setProgress(p);
                bar.setVisibility(p >= 100 ? View.INVISIBLE : View.VISIBLE);
            }

            @Override
            public void onReceivedTitle(WebView view, String t) {
                title.setText(t);
            }
        });
        web.setDownloadListener((url, ua, cd, mime, len) -> download(url, ua, cd, mime, len));
        col.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        root.addView(col, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    // ── a download: into the app's storage, then to the game ──
    private void download(String url, String ua, String cd, String mime, long len) {
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
            Toast.makeText(act, "هذا النوع من التنزيل لا يصل إلى اللعبة", Toast.LENGTH_LONG).show();
            return;
        }
        if (downloading) {
            Toast.makeText(act, "انتظر حتى ينتهي التنزيل الحالي", Toast.LENGTH_SHORT).show();
            return;
        }
        downloading = true;
        String name = URLUtil.guessFileName(url, cd, mime).replaceAll("[^A-Za-z0-9._ -]", "_").trim();
        if (name.isEmpty() || name.startsWith(".")) name = "download" + name;
        final String fname = name;
        final String referer = web.getUrl();
        final String cookie = CookieManager.getInstance().getCookie(url);
        status.setVisibility(View.VISIBLE);
        status.setText("تنزيل " + fname);
        new Thread(() -> {
            File dir = new File(act.getFilesDir(), "lib/dl");
            dir.mkdirs();
            File out = new File(dir, fname);
            long got = 0;
            String err = null;
            try {
                HttpURLConnection c = MainActivity.open(url, ua, cookie, referer, null);
                int code = c.getResponseCode();
                if (code >= 400) throw new Exception("HTTP " + code);
                long total = c.getContentLengthLong() > 0 ? c.getContentLengthLong() : len;
                long t = 0;
                try (InputStream in = c.getInputStream(); OutputStream o = new FileOutputStream(out)) {
                    byte[] buf = new byte[1 << 16];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        o.write(buf, 0, n);
                        got += n;
                        long now = System.currentTimeMillis();
                        if (now - t > 300) {
                            t = now;
                            final String m = total > 0 ? String.format(Locale.US, "%d%%", got * 100 / total) : (got / 1048576) + " MB";
                            act.runOnUiThread(() -> status.setText("تنزيل " + m));
                        }
                    }
                }
                c.disconnect();
            } catch (Exception e) {
                err = e.getMessage();
                out.delete();
            }
            final String e2 = err;
            final long size = got;
            act.runOnUiThread(() -> {
                downloading = false;
                status.setVisibility(View.GONE);
                if (e2 != null) {
                    Toast.makeText(act, "تعذّر التنزيل: " + e2, Toast.LENGTH_LONG).show();
                    return;
                }
                Toast.makeText(act, "نُزّل «" + fname + "» · يُضاف إلى اللعبة الآن", Toast.LENGTH_LONG).show();
                try {
                    JSONObject ev = new JSONObject();
                    ev.put("t", "dl");
                    ev.put("path", "dl/" + fname);
                    ev.put("name", fname);
                    ev.put("size", size);
                    ev.put("mime", mime == null ? "" : mime);
                    ev.put("src", Uri.parse(url).getHost());
                    act.gameEvent(ev.toString());
                } catch (Exception ignored) { /* never */ }
                close();
            });
        }).start();
    }
}
