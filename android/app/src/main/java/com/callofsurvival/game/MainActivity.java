package com.callofsurvival.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Call of Survival on Android: the game page in a full-screen WebView. The page and its files come from inside the app
 * (or from a downloaded update, see Updater) on the address https://appassets.androidplatform.net/, so the game keeps
 * its saves there (localStorage, IndexedDB) from one version to the next. three.js and its readers, which the page asks
 * the CDNs for, are kept in the app too, so the game also starts with no connection.
 * For the editor's libraries the app also answers: /_app/info (what this app can do), /_net/get?u= (a site's API or file,
 * fetched by the app: no site refuses it as a page from elsewhere), /_app/browse?u= (the app's own browser over the game),
 * /_lib/… (what was downloaded in it) and /_app/libdel?p= (taken into the game, so deleted).
 */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/index.html";
    static final int REQ_FILES = 41;

    // the back button: the libraries and the editor's catalogue close, the editor is left, the pause menu opens and closes; at the menus the app steps aside
    static final String BACK_JS = "(function(){try{"
            + "if(typeof LIB!=='undefined'&&LIB.on){libClose();return 'k';}"
            + "if(typeof ED!=='undefined'&&ED.on){var c=document.getElementById('edCat');if(c&&!c.classList.contains('gone')){edCatOpen(false);return 'k';}edLeave(false);return 'k';}"
            + "if(typeof started!=='undefined'&&started){window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape',bubbles:true}));return 'k';}"
            + "}catch(e){}return 'x';})()";

    private FrameLayout frame;
    private WebView web;
    private ValueCallback<Uri[]> fileCb;
    Updater updater;
    Browser browser;
    static String UA = "CallOfSurvival/" + BuildConfig.VERSION_CODE;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            w.setAttributes(lp);
        }
        frame = new FrameLayout(this);
        frame.setBackgroundColor(0xFF000000);
        setContentView(frame);
        hideBars();
        updater = new Updater(this);
        updater.prepare();
        web = makeWebView();
        frame.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        browser = new Browser(this, frame);
        if (updater.current() > 0) {
            web.loadUrl(START);
            updater.check();
        } else {
            // the small APK carries no game: it is downloaded the first time (then it updates like the full one)
            web.loadUrl("about:blank");
            updater.firstRun();
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private WebView makeWebView() {
        WebView v = new WebView(this);
        v.setBackgroundColor(0xFF000000);
        WebSettings s = v.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setTextZoom(100);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        // the sites' APIs ask every program to name itself (Poly Haven needs it)
        UA = s.getUserAgentString() + " CallOfSurvival/" + BuildConfig.VERSION_CODE;
        s.setUserAgentString(UA);
        v.setOverScrollMode(View.OVER_SCROLL_NEVER);
        v.setVerticalScrollBarEnabled(false);
        v.setHorizontalScrollBarEnabled(false);
        v.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return serve(req.getUrl(), req.getRequestHeaders());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* no browser */ }
                return true;     // links out of the game open in the browser
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                restart();       // the page ran out of memory: start it again instead of closing the app
                return true;
            }
        });
        v.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams p) {
                return pickFiles(cb, p);
            }
        });
        return v;
    }

    private void restart() {
        if (web != null) {
            frame.removeView(web);
            web.destroy();
        }
        web = makeWebView();
        frame.addView(web, 0, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.loadUrl(START);
    }

    /** after an update: the new version of the page */
    void reloadGame() {
        if (web != null) web.loadUrl(START);
    }

    // ── what the page asks for ──
    WebResourceResponse serve(Uri u, Map<String, String> headers) {
        String host = u.getHost();
        if (host == null) return null;
        String path = u.getPath();
        if (path == null || path.isEmpty() || path.equals("/")) path = "/index.html";
        if (HOST.equals(host)) {
            String p = path.substring(1);
            if (p.contains("..")) return missing();
            if (p.equals("_app/info")) return json("{\"app\":1,\"shell\":" + BuildConfig.SHELL + ",\"net\":1,\"browse\":1,\"v\":" + BuildConfig.VERSION_CODE + "}");
            if (p.equals("_net/get")) return net(u.getQueryParameter("u"), headers);
            if (p.equals("_app/browse")) {
                final String to = u.getQueryParameter("u");
                if (to == null || !(to.startsWith("https://") || to.startsWith("http://"))) return json("{\"ok\":0}");
                runOnUiThread(() -> browser.show(to));
                return json("{\"ok\":1}");
            }
            if (p.startsWith("_lib/")) {
                File f = new File(new File(getFilesDir(), "lib"), p.substring(5));
                try { return f.isFile() ? response(f.getName(), new FileInputStream(f)) : missing(); } catch (IOException e) { return missing(); }
            }
            if (p.equals("_app/libdel")) {
                String q = u.getQueryParameter("p");
                if (q != null && !q.contains("..")) new File(new File(getFilesDir(), "lib"), q).delete();
                return json("{\"ok\":1}");
            }
            InputStream in = updater.open(p);
            return in == null ? missing() : response(p, in);
        }
        if (host.equals("cdnjs.cloudflare.com") || host.equals("cdn.jsdelivr.net")) {
            try {
                String p = "cdn/" + host + path.replace("@", "-at-");
                return response(p, getAssets().open(p));
            } catch (IOException e) {
                return null;     // not kept in the app: from the internet
            }
        }
        return null;
    }

    static WebResourceResponse response(String name, InputStream in) {
        String mime = mime(name);
        boolean text = mime.startsWith("text/") || mime.equals("application/javascript") || mime.equals("application/json");
        WebResourceResponse r = new WebResourceResponse(mime, text ? "utf-8" : null, in);
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");
        h.put("Cache-Control", "no-cache");
        r.setResponseHeaders(h);
        return r;
    }

    static WebResourceResponse json(String body) {
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");
        h.put("Cache-Control", "no-store");
        return new WebResourceResponse("application/json", "utf-8", 200, "OK", h, new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
    }

    /** a connection to a site, its redirects followed by hand (a sign-in token is only sent to the first site) */
    static HttpURLConnection open(String url, String ua, String cookie, String referer, String auth) throws IOException {
        URL at = new URL(url);
        String host0 = at.getHost();
        for (int hop = 0; ; hop++) {
            HttpURLConnection c = (HttpURLConnection) at.openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(20000);
            c.setReadTimeout(90000);
            c.setRequestProperty("User-Agent", ua != null ? ua : UA);
            if (cookie != null && !cookie.isEmpty() && at.getHost().equals(new URL(url).getHost())) c.setRequestProperty("Cookie", cookie);
            if (referer != null) c.setRequestProperty("Referer", referer);
            if (auth != null && at.getHost().equals(host0)) c.setRequestProperty("Authorization", auth);
            int code = c.getResponseCode();
            if (code >= 300 && code < 400 && hop < 8) {
                String loc = c.getHeaderField("Location");
                if (loc == null) return c;
                c.disconnect();
                at = new URL(at, loc);
                if (!"https".equals(at.getProtocol()) && !"http".equals(at.getProtocol())) throw new IOException("redirect");
                continue;
            }
            return c;
        }
    }

    /** a site's API or file for the page (GET only, https only) */
    WebResourceResponse net(String url, Map<String, String> headers) {
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");
        h.put("Cache-Control", "no-store");
        if (url == null || !url.startsWith("https://")) return new WebResourceResponse("text/plain", "utf-8", 400, "Bad Request", h, new ByteArrayInputStream(new byte[0]));
        String auth = null;
        if (headers != null) for (Map.Entry<String, String> e : headers.entrySet()) if ("x-cos-auth".equalsIgnoreCase(e.getKey())) auth = e.getValue();
        try {
            HttpURLConnection c = open(url, UA, null, null, auth);
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            if (in == null) in = new ByteArrayInputStream(new byte[0]);
            String ct = c.getContentType(), mime = "application/octet-stream", cs = null;
            if (ct != null) {
                String[] parts = ct.split(";");
                mime = parts[0].trim();
                for (String q : parts) if (q.trim().toLowerCase(Locale.ROOT).startsWith("charset=")) cs = q.trim().substring(8);
            }
            long len = c.getContentLengthLong();
            if (len >= 0) h.put("X-Cos-Size", String.valueOf(len));
            if (code < 200 || (code >= 300 && code < 400) || code > 599) code = 502;
            String why = c.getResponseMessage();
            return new WebResourceResponse(mime, cs, code, why == null || why.isEmpty() ? (code < 300 ? "OK" : "Error") : why, h, in);
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "utf-8", 502, "Bad Gateway", h, new ByteArrayInputStream(String.valueOf(e.getMessage()).getBytes(StandardCharsets.UTF_8)));
        }
    }

    /** news for the game page (a download finished) */
    void gameEvent(String json) {
        if (web != null) web.evaluateJavascript("window.cosAppEvent&&window.cosAppEvent(" + json + ")", null);
    }

    static WebResourceResponse missing() {
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", h, new ByteArrayInputStream(new byte[0]));
    }

    static String mime(String name) {
        String n = name.toLowerCase(Locale.ROOT);
        int dot = n.lastIndexOf('.');
        String ext = dot >= 0 ? n.substring(dot + 1) : "";
        switch (ext) {
            case "html": case "htm": return "text/html";
            case "js": return "application/javascript";
            case "json": return "application/json";
            case "css": return "text/css";
            case "txt": return "text/plain";
            case "svg": return "image/svg+xml";
            case "webp": return "image/webp";
            case "jpg": case "jpeg": return "image/jpeg";
            case "png": return "image/png";
            case "gif": return "image/gif";
            case "mp4": return "video/mp4";
            case "webm": return "video/webm";
            case "m4a": return "audio/mp4";
            case "ogg": return "audio/ogg";
            case "mp3": return "audio/mpeg";
            case "wav": return "audio/wav";
            case "wasm": return "application/wasm";
            case "glb": return "model/gltf-binary";
            case "woff2": return "font/woff2";
            case "woff": return "font/woff";
            case "ttf": return "font/ttf";
            default: return "application/octet-stream";
        }
    }

    // ── files picked for the editor's uploads ──
    private boolean pickFiles(ValueCallback<Uri[]> cb, WebChromeClient.FileChooserParams p) {
        if (fileCb != null) fileCb.onReceiveValue(null);
        fileCb = cb;
        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        if (p != null && p.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        try {
            startActivityForResult(Intent.createChooser(i, "اختر الملفات"), REQ_FILES);
            return true;
        } catch (Exception e) {
            fileCb = null;
            return false;
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_FILES) {
            Uri[] out = null;
            if (res == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    out = new Uri[n];
                    for (int k = 0; k < n; k++) out[k] = data.getClipData().getItemAt(k).getUri();
                } else if (data.getData() != null) {
                    out = new Uri[]{data.getData()};
                }
            }
            if (fileCb != null) fileCb.onReceiveValue(out);
            fileCb = null;
            return;
        }
        super.onActivityResult(req, res, data);
    }

    // ── the screen: all of it, the bars hidden (a swipe shows them for a moment) ──
    private void hideBars() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    @Override
    public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        hideBars();
    }

    @Override
    public void onBackPressed() {
        if (browser != null && browser.back()) return;
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript(BACK_JS, r -> {
            if (r == null || !r.contains("k")) moveTaskToBack(true);
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        hideBars();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            frame.removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
