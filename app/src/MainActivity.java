package com.spiracompanion.thor;

import android.app.Activity;
import android.content.Intent;
import android.content.UriPermission;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.DocumentsContract;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.SequenceInputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final int PICK_FOLDER = 30;
    private static final int PICK_GUIDE = 31;
    private static final int SAVE_COMPANION = 32;
    private static final int OPEN_COMPANION = 33;
    private static final String GUIDE_URL = "https://guide.spira.invalid/walkthrough.html";
    private static final String CHEAT_MENU_PREF = "cheatMenu";
    private static final String GUIDE_HASH = "5cf7b64256cc5e53453e1358a16acc7f51b72679e48856569724e4f72a853784";
    private static final int GUIDE_SIZE = 40660758;
    private static final int MAX_FRAME_BYTES = 64 * 1024;
    private static final long PS2_HANDOFF_GRACE_MS = 3000;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService reader = Executors.newSingleThreadExecutor();
    private WebView view;
    private Uri liveFile;
    private File guideFile;
    private volatile boolean resumed;
    private volatile long sessionGeneration;
    private long lastPs2ActiveAt = -1;
    private boolean reading, ready;
    private final String cheatToken = java.util.UUID.randomUUID().toString();
    private volatile boolean cheatMenu;
    private long pendingCheatGeneration = -1;
    private volatile boolean sharePartyAp;
    private String pendingExport, pendingImportKind;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        cheatMenu = getPreferences(MODE_PRIVATE).getBoolean(CHEAT_MENU_PREF, false);
        getWindow().getDecorView().setKeepScreenOn(true);
        getWindow().getDecorView().setBackgroundColor(0xff101e25);
        view = new WebView(this);
        view.setBackgroundColor(0xff101e25);
        view.getSettings().setJavaScriptEnabled(true);
        view.getSettings().setDomStorageEnabled(true);
        view.getSettings().setAllowContentAccess(false);
        view.getSettings().setAllowFileAccess(false);
        view.addJavascriptInterface(new SetupActions(), "SpiraSetup");
        guideFile = new File(getFilesDir(), "jegged-walkthrough.html");
        view.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView source, WebResourceRequest request) {
                return request.isForMainFrame() || !GUIDE_URL.equals(request.getUrl().toString());
            }

            @Override public WebResourceResponse shouldInterceptRequest(WebView source, WebResourceRequest request) {
                if (!"guide.spira.invalid".equals(request.getUrl().getHost())) return null;
                if (GUIDE_URL.equals(request.getUrl().toString()) && !request.isForMainFrame()) {
                    try {
                        return new WebResourceResponse("text/html", "UTF-8", 200, "OK",
                            java.util.Map.of("Cache-Control", "no-store", "Content-Security-Policy",
                                "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:"),
                            new SequenceInputStream(new FileInputStream(guideFile), getAssets().open("guide-reader.html")));
                    } catch (IOException ignored) {
                        // The guide can be selected again if its document permission was lost.
                    }
                }
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", java.util.Map.of(),
                    new java.io.ByteArrayInputStream(new byte[0]));
            }

            @Override public void onPageStarted(WebView source, String url, android.graphics.Bitmap favicon) {
                if ("file:///android_asset/index.html".equals(url)) {
                    sessionGeneration++;
                    sharePartyAp = false;
                    ready = false;
                }
            }

            @Override public void onPageFinished(WebView source, String url) {
                if (!"file:///android_asset/index.html".equals(url)) return;
                ready = true;
                view.evaluateJavascript("window.SpiraCheats.initialize(" + JSONObject.quote(cheatToken) +
                    "," + cheatMenu + ")", null);
                showGuideFile();
                refresh();
            }
        });
        setContentView(view);
        restoreFolder();
        view.loadUrl("file:///android_asset/index.html");
    }

    @Override protected void onResume() {
        super.onResume();
        resumed = true;
        WindowInsetsController bars = getWindow().getInsetsController();
        if (bars != null) {
            bars.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            bars.hide(WindowInsets.Type.systemBars());
        }
        refresh();
    }

    @Override protected void onPause() {
        if (pendingCheatGeneration == sessionGeneration) {
            cheatResult(false, "The companion session changed. Check the live amount before trying again.");
        }
        resumed = false;
        sessionGeneration++;
        handler.removeCallbacks(poll);
        super.onPause();
    }

    @Override protected void onDestroy() {
        sessionGeneration++;
        ready = false;
        reader.shutdownNow();
        view.destroy();
        super.onDestroy();
    }

    private void restoreFolder() {
        String saved = getPreferences(MODE_PRIVATE).getString("folder", "");
        if (saved.isEmpty()) return;
        Uri tree = Uri.parse(saved);
        for (UriPermission permission : getContentResolver().getPersistedUriPermissions()) {
            if (permission.isReadPermission() && permission.getUri().equals(tree)) {
                useFolder(tree);
                return;
            }
        }
    }

    private void useFolder(Uri tree) {
        String id = DocumentsContract.getTreeDocumentId(tree);
        liveFile = DocumentsContract.buildDocumentUriUsingTree(tree, id + "/live.json");
    }

    private final class SetupActions {
        @JavascriptInterface public void showCheatMenu(String token, boolean show) {
            if (!cheatToken.equals(token)) return;
            runOnUiThread(() -> {
                cheatMenu = show;
                if (!show) sharePartyAp = false;
                getPreferences(MODE_PRIVATE).edit().putBoolean(CHEAT_MENU_PREF, show).apply();
                if (ready) view.evaluateJavascript("window.SpiraCheats.visibility(" + show + ")", null);
            });
        }

        @JavascriptInterface public void partyApSharing(String token, boolean enabled) {
            if (!cheatToken.equals(token)) return;
            runOnUiThread(() -> {
                sharePartyAp = cheatMenu && enabled;
                if (ready) view.evaluateJavascript("window.SpiraCheats.apSharing(" + sharePartyAp + ")", null);
            });
        }

        @JavascriptInterface public void exportCompanion(String filename, String content) {
            if (content == null || content.length() > 4 * 1024 * 1024 || filename == null || !filename.matches("[A-Za-z0-9._-]{1,100}\\.json")) return;
            runOnUiThread(() -> {
                if (pendingExport != null) return;
                pendingExport = content;
                Intent picker = new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json");
                picker.addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE, filename);
                startActivityForResult(picker, SAVE_COMPANION);
            });
        }

        @JavascriptInterface public void importCompanion(String kind) {
            if (!"profile".equals(kind) && !"grid".equals(kind)) return;
            runOnUiThread(() -> {
                pendingImportKind = kind;
                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*");
                picker.addCategory(Intent.CATEGORY_OPENABLE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivityForResult(picker, OPEN_COMPANION);
            });
        }

        @JavascriptInterface public void applyCheat(String token, String disc, int room, int story,
                int item, int expected, int target) {
            if (!cheatToken.equals(token)) return;
            long generation = sessionGeneration;
            runOnUiThread(() -> {
                if (!ready || !activeSession(generation) || pendingCheatGeneration == generation) return;
                if (!cheatMenu) {
                    cheatResult(false, "Cheat Menu is disabled.");
                    return;
                }
                pendingCheatGeneration = generation;
                reader.execute(() -> {
                    String message;
                    try {
                        message = Ps2Feed.applyCheat(disc, room, story, item, expected, target,
                            () -> cheatMenu && activeSession(generation));
                    } catch (Exception e) {
                        message = "ARMSX2 did not confirm the change. Check the live amount before trying again.";
                    }
                    String result = message;
                    handler.post(() -> {
                        if (pendingCheatGeneration == generation) pendingCheatGeneration = -1;
                        if (!activeSession(generation)) return;
                        cheatResult(result.isEmpty(), result);
                        refresh();
                    });
                });
            });
        }

        @JavascriptInterface public void pickGuide() {
            runOnUiThread(() -> {
                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("text/html");
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                picker.putExtra(DocumentsContract.EXTRA_INITIAL_URI, DocumentsContract.buildDocumentUri(
                    "com.android.externalstorage.documents", "primary:Download/Thor-Guides"));
                startActivityForResult(picker, PICK_GUIDE);
            });
        }

        @JavascriptInterface public void pickFolder() {
            runOnUiThread(() -> {
                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                picker.putExtra(DocumentsContract.EXTRA_INITIAL_URI, DocumentsContract.buildDocumentUri(
                    "com.android.externalstorage.documents", "primary:Download/SpiraCompanion"));
                startActivityForResult(picker, PICK_FOLDER);
            });
        }
    }

    private void cheatResult(boolean applied, String message) {
        if (ready) view.evaluateJavascript("window.SpiraCheats.result(" + applied + "," +
            JSONObject.quote(message) + ")", null);
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == SAVE_COMPANION) {
            String content = pendingExport; pendingExport = null;
            if (result != RESULT_OK || data == null || data.getData() == null || content == null) return;
            Uri destination = data.getData();
            reader.execute(() -> {
                try (java.io.OutputStream output = getContentResolver().openOutputStream(destination, "wt")) {
                    if (output == null) throw new IOException();
                    output.write(content.getBytes(StandardCharsets.UTF_8));
                    documentMessage("Backup exported.");
                } catch (Exception e) { documentMessage("Could not export. Choose another destination."); }
            });
            return;
        }
        if (request == OPEN_COMPANION) {
            String kind = pendingImportKind; pendingImportKind = null;
            if (result != RESULT_OK || data == null || data.getData() == null || kind == null) return;
            Uri source = data.getData();
            reader.execute(() -> {
                try (InputStream input = getContentResolver().openInputStream(source)) {
                    if (input == null) throw new IOException();
                    java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
                    byte[] chunk = new byte[8192];
                    int read;
                    while ((read = input.read(chunk)) != -1) {
                        if (buffer.size() + read > 4 * 1024 * 1024) throw new IOException();
                        buffer.write(chunk, 0, read);
                    }
                    byte[] bytes = buffer.toByteArray();
                    if (bytes.length > 4 * 1024 * 1024) throw new IOException();
                    String text = new String(bytes, StandardCharsets.UTF_8);
                    handler.post(() -> { if (ready) view.evaluateJavascript("window.SpiraDocuments.imported(" + JSONObject.quote(kind) + "," + JSONObject.quote(text) + ")", null); });
                } catch (Exception e) { documentMessage("Could not read this backup. Choose a JSON file smaller than 4 MB."); }
            });
            return;
        }
        if (result != RESULT_OK || data == null || data.getData() == null) return;
        Uri tree = data.getData();
        if (request == PICK_GUIDE) {
            reader.execute(() -> {
                boolean imported = importGuide(tree);
                handler.post(() -> {
                    if (imported) showGuideFile();
                    else guideError("Could not load this copy. Choose FFX - Complete Offline Walkthrough.html from Thor-Guides.");
                });
            });
            return;
        }
        if (request != PICK_FOLDER) return;
        String id = DocumentsContract.getTreeDocumentId(tree);
        if (!"com.android.externalstorage.documents".equals(tree.getAuthority()) ||
                !id.endsWith("/SpiraCompanion")) {
            view.evaluateJavascript("Spira.setupError('Select the SpiraCompanion folder inside Download.')", null);
            return;
        }
        try {
            getContentResolver().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            String old = getPreferences(MODE_PRIVATE).getString("folder", "");
            if (!old.isEmpty() && !old.equals(tree.toString())) {
                for (UriPermission permission : getContentResolver().getPersistedUriPermissions()) {
                    if (permission.isReadPermission() && permission.getUri().toString().equals(old)) {
                        getContentResolver().releasePersistableUriPermission(permission.getUri(), Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    }
                }
            }
            useFolder(tree);
            getPreferences(MODE_PRIVATE).edit().putString("folder", tree.toString()).apply();
            refresh();
        } catch (SecurityException e) {
            view.evaluateJavascript("Spira.setupError('Android did not grant access. Choose the folder again.')", null);
        }
    }

    private void showGuideFile() {
        if (ready) view.evaluateJavascript("window.SpiraGuide.fileChanged(" + guideFile.isFile() + ")", null);
    }

    private boolean importGuide(Uri file) {
        File pending = new File(getFilesDir(), "jegged-walkthrough.import");
        try (InputStream input = getContentResolver().openInputStream(file)) {
            if (input == null) return false;
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[64 * 1024];
            int size = 0;
            try (FileOutputStream output = new FileOutputStream(pending)) {
                int length;
                while ((length = input.read(buffer)) != -1) {
                    size += length;
                    if (size > GUIDE_SIZE) return false;
                    digest.update(buffer, 0, length);
                    output.write(buffer, 0, length);
                }
            }
            if (size != GUIDE_SIZE) return false;
            StringBuilder hex = new StringBuilder(64);
            for (byte value : digest.digest()) hex.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
            return GUIDE_HASH.contentEquals(hex) && pending.renameTo(guideFile);
        } catch (Exception ignored) {
            return false;
        } finally {
            pending.delete();
        }
    }

    private void guideError(String message) {
        if (ready) view.evaluateJavascript("window.SpiraGuide.error(" + JSONObject.quote(message) + ")", null);
    }

    private final Runnable poll = this::refresh;

    private boolean activeSession(long generation) {
        return resumed && generation == sessionGeneration;
    }

    private void refresh() {
        handler.removeCallbacks(poll);
        if (!resumed || !ready || reading) return;
        Uri file = liveFile;
        long generation = sessionGeneration;
        reading = true;
        reader.execute(() -> {
            String content = activeSession(generation) ? readSnapshot(file, generation) : null;
            handler.post(() -> {
                reading = false;
                if (!ready || !resumed) return;
                if (!activeSession(generation) || !java.util.Objects.equals(file, liveFile)) {
                    refresh();
                    return;
                }
                String value = content == null ? "null" : JSONObject.quote(content);
                view.evaluateJavascript("Spira.update(" + value + ", " + (file != null) + ")", null);
                handler.postDelayed(poll, 500);
            });
        });
    }

    private String readSnapshot(Uri file, long generation) {
        JSONObject ps2 = null;
        try {
            ps2 = Ps2Feed.snapshot();
        } catch (Exception e) {
            // A stopped emulator has no listener. Try the optional Steam feed next.
        }
        if (!activeSession(generation)) return null;
        if (ps2 != null && !"waiting".equals(ps2.optString("status"))) {
            lastPs2ActiveAt = SystemClock.elapsedRealtime();
            if (sharePartyAp && cheatMenu) {
                try { Ps2Feed.sharePartyAp(ps2, () -> sharePartyAp && cheatMenu && activeSession(generation)); }
                catch (Exception ignored) { /* Never interrupt the read-only feed for an optional boost. */ }
            }
            return ps2.toString();
        }
        if (file == null || lastPs2ActiveAt >= 0 && SystemClock.elapsedRealtime() - lastPs2ActiveAt < PS2_HANDOFF_GRACE_MS) {
            return ps2 == null ? null : ps2.toString();
        }
        try (InputStream input = getContentResolver().openInputStream(file)) {
            if (input == null) return null;
            ByteArrayOutputStream data = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int length;
            while ((length = input.read(buffer)) != -1) {
                if (data.size() + length > MAX_FRAME_BYTES) return null;
                data.write(buffer, 0, length);
            }
            return data.toString(StandardCharsets.UTF_8.name());
        } catch (Exception e) {
            return null;
        }
    }

    private void documentMessage(String message) {
        handler.post(() -> { if (ready) view.evaluateJavascript("window.SpiraDocuments.message(" + JSONObject.quote(message) + ")", null); });
    }
}
