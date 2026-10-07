package com.agricovet.app;

import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.app.NotificationCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "AgricovetNative";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        configureWebView();
    }

    private void configureWebView() {
        mainHandler.postDelayed(() -> {
            try {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    WebView webView = getBridge().getWebView();

                    WebSettings settings = webView.getSettings();
                    settings.setDomStorageEnabled(true);
                    settings.setDatabaseEnabled(true);
                    settings.setAllowFileAccess(true);
                    settings.setAllowContentAccess(true);
                    settings.setGeolocationEnabled(true);
                    settings.setJavaScriptCanOpenWindowsAutomatically(true);

                    AndroidBridge bridgeInterface = new AndroidBridge(this, webView);
                    webView.addJavascriptInterface(bridgeInterface, "AndroidDownloader");
                    webView.addJavascriptInterface(bridgeInterface, "AndroidBridge");

                    // HTTP Download listener for direct files / exports
                    webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
                        bridgeInterface.handleHttpDownload(url, userAgent, contentDisposition, mimetype);
                    });

                    Log.d(TAG, "WebView configurado con AndroidDownloader y DownloadListener exitosamente.");
                }
            } catch (Exception ex) {
                Log.e(TAG, "Error configurando WebView:", ex);
            }
        }, 500);
    }

    @Override
    public void onBackPressed() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            // Permite a la app web cerrar modales antes de salir de la aplicación
            webView.evaluateJavascript(
                "(function() { " +
                "  if (typeof window.__handleAndroidBackButton === 'function') { " +
                "    return window.__handleAndroidBackButton(); " +
                "  } " +
                "  return false; " +
                "})()",
                result -> {
                    if ("true".equals(result) || "\"true\"".equals(result)) {
                        return; // Modal cerrado en JavaScript
                    }
                    if (webView.canGoBack()) {
                        webView.goBack();
                    } else {
                        MainActivity.super.onBackPressed();
                    }
                }
            );
            return;
        }
        super.onBackPressed();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                // Delete legacy channels if present
                try {
                    manager.deleteNotificationChannel("agricovet_orders_channel");
                    manager.deleteNotificationChannel("agricovet_orders_channel_v2");
                    manager.deleteNotificationChannel("agricovet_orders_channel_v3");
                } catch (Exception ignored) {}

                String channelId = "agricovet_orders_channel_v4";
                CharSequence name = "Pedidos y Facturación Agricovet";
                String description = "Notificaciones prioritarias con sonido de pedidos y facturas";
                int importance = NotificationManager.IMPORTANCE_HIGH;

                NotificationChannel channel = new NotificationChannel(channelId, name, importance);
                channel.setDescription(description);
                channel.enableLights(true);
                channel.setLightColor(Color.parseColor("#16a34a"));
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{0, 250, 150, 250});

                try {
                    Uri soundUri = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/" + R.raw.whatsapp);
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                            .build();
                    channel.setSound(soundUri, audioAttributes);
                } catch (Exception soundEx) {
                    // Fallback to default sound if raw resource fails
                }

                manager.createNotificationChannel(channel);
            }
        }
    }

    public class AndroidBridge {
        private final Context context;
        private final WebView webView;

        public AndroidBridge(Context context, WebView webView) {
            this.context = context;
            this.webView = webView;
        }

        @JavascriptInterface
        public boolean isNativeAndroid() {
            return true;
        }

        /**
         * Recibe un archivo en Base64 desde JavaScript y lo guarda de inmediato
         * en la carpeta pública de Descargas de Android, mostrando notificación y abriendo el visor/compartir.
         */
        @JavascriptInterface
        public void downloadBase64(String base64Data, String filename, String mimeType) {
            executor.execute(() -> {
                try {
                    if (base64Data == null || base64Data.trim().isEmpty()) {
                        Log.w(TAG, "Base64 data vacía al intentar descargar");
                        return;
                    }

                    String cleanFilename = (filename == null || filename.trim().isEmpty())
                            ? "comprobante_agricovet_" + System.currentTimeMillis() + ".pdf"
                            : filename.replaceAll("[\\\\/:*?\"<>|]", "_");

                    String cleanMime = (mimeType == null || mimeType.trim().isEmpty())
                            ? (cleanFilename.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            : cleanFilename.endsWith(".xml") ? "application/xml"
                            : "application/pdf")
                            : mimeType;

                    String rawBase64 = base64Data;
                    if (rawBase64.contains(",")) {
                        rawBase64 = rawBase64.substring(rawBase64.indexOf(",") + 1);
                    }
                    byte[] bytes = Base64.decode(rawBase64, Base64.DEFAULT);

                    // 1. Guardar en caché interna para compartir vía FileProvider de forma segura
                    File cacheFile = new File(context.getCacheDir(), cleanFilename);
                    try (FileOutputStream fos = new FileOutputStream(cacheFile)) {
                        fos.write(bytes);
                        fos.flush();
                    }

                    Uri fileProviderUri = null;
                    try {
                        fileProviderUri = FileProvider.getUriForFile(
                                context,
                                context.getPackageName() + ".fileprovider",
                                cacheFile
                        );
                    } catch (Exception ex) {
                        Log.e(TAG, "Error obteniendo FileProvider URI:", ex);
                    }

                    // 2. Guardar en almacenamiento público de Descargas (Downloads)
                    Uri downloadedUri = null;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.Downloads.DISPLAY_NAME, cleanFilename);
                        values.put(MediaStore.Downloads.MIME_TYPE, cleanMime);
                        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                        values.put(MediaStore.Downloads.IS_PENDING, 1);

                        ContentResolver resolver = context.getContentResolver();
                        downloadedUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (downloadedUri != null) {
                            try (OutputStream os = resolver.openOutputStream(downloadedUri)) {
                                if (os != null) {
                                    os.write(bytes);
                                    os.flush();
                                }
                            }
                            values.clear();
                            values.put(MediaStore.Downloads.IS_PENDING, 0);
                            resolver.update(downloadedUri, values, null, null);
                        }
                    } else {
                        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                        if (!downloadsDir.exists()) downloadsDir.mkdirs();
                        File pubFile = new File(downloadsDir, cleanFilename);
                        try (FileOutputStream fos = new FileOutputStream(pubFile)) {
                            fos.write(bytes);
                            fos.flush();
                        }
                        downloadedUri = Uri.fromFile(pubFile);
                        MediaScannerConnection.scanFile(context, new String[]{pubFile.getAbsolutePath()}, new String[]{cleanMime}, null);
                    }

                    final Uri targetOpenUri = fileProviderUri != null ? fileProviderUri : downloadedUri;

                    mainHandler.post(() -> {
                        Toast.makeText(context, "✅ Guardado en Descargas: " + cleanFilename, Toast.LENGTH_LONG).show();

                        if (targetOpenUri != null) {
                            // Abrir menú selector para ver PDF, guardar en Drive o enviar por WhatsApp
                            Intent shareIntent = new Intent(Intent.ACTION_SEND);
                            shareIntent.setType(cleanMime);
                            shareIntent.putExtra(Intent.EXTRA_STREAM, targetOpenUri);
                            shareIntent.putExtra(Intent.EXTRA_SUBJECT, cleanFilename);
                            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                            viewIntent.setDataAndType(targetOpenUri, cleanMime);
                            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                            Intent chooser = Intent.createChooser(shareIntent, "Abrir comprobante: " + cleanFilename);
                            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            try {
                                context.startActivity(chooser);
                            } catch (Exception e1) {
                                try {
                                    Intent viewChooser = Intent.createChooser(viewIntent, "Abrir con");
                                    viewChooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    context.startActivity(viewChooser);
                                } catch (Exception ignored) {}
                            }
                        }
                    });

                } catch (Exception e) {
                    Log.e(TAG, "Error guardando archivo en Android:", e);
                    mainHandler.post(() -> Toast.makeText(context, "Error al guardar descarga: " + e.getMessage(), Toast.LENGTH_LONG).show());
                }
            });
        }

        /**
         * Imprime directamente usando el spooler nativo de Android PrintManager
         */
        @JavascriptInterface
        public void printHtml(String html, String jobName) {
            mainHandler.post(() -> {
                try {
                    String cleanName = (jobName == null || jobName.isEmpty()) ? "Factura_Agricovet" : jobName;
                    WebView printView = new WebView(context);
                    printView.setWebViewClient(new WebViewClient() {
                        @Override
                        public void onPageFinished(WebView view, String url) {
                            try {
                                PrintManager printManager = (PrintManager) context.getSystemService(Context.PRINT_SERVICE);
                                if (printManager != null) {
                                    PrintDocumentAdapter printAdapter = printView.createPrintDocumentAdapter(cleanName);
                                    printManager.print(cleanName, printAdapter, new PrintAttributes.Builder().build());
                                }
                            } catch (Exception pEx) {
                                Log.e(TAG, "Error iniciando PrintManager:", pEx);
                            }
                        }
                    });
                    printView.loadDataWithBaseURL("https://agricovet.lat", html, "text/html", "UTF-8", null);
                } catch (Exception ex) {
                    Log.e(TAG, "Error preparando impresión:", ex);
                }
            });
        }

        /**
         * Maneja descargas HTTP estándar que provienen de la app
         */
        public void handleHttpDownload(String url, String userAgent, String contentDisposition, String mimetype) {
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimetype);
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null) {
                    request.addRequestHeader("cookie", cookies);
                }
                request.addRequestHeader("User-Agent", userAgent);
                request.setDescription("Descargando archivo desde Agricovet...");
                String filename = URLUtil.guessFileName(url, contentDisposition, mimetype);
                request.setTitle(filename);
                request.allowScanningByMediaScanner();
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

                DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(request);
                    Toast.makeText(context, "Descargando: " + filename, Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                Log.e(TAG, "Error en DownloadManager, abriendo vía navegador:", e);
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                } catch (Exception ignored) {}
            }
        }
    }
}
