package in.taramedicos.taraconnect;

import android.os.Bundle;
import android.os.Build;
import android.os.Environment;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Enable WebView debugging for developer diagnostics
        WebView.setWebContentsDebuggingEnabled(true);
        
        registerDownloader();
    }

    @Override
    public void onStart() {
        super.onStart();
        registerDownloader();
    }

    private void registerDownloader() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().addJavascriptInterface(new BlobDownloadInterface(this), "AndroidDownloader");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static class BlobDownloadInterface {
        private final Context context;

        public BlobDownloadInterface(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void downloadBase64(String base64Data, String fileName, String mimeType) {
            try {
                if (base64Data == null || base64Data.isEmpty()) return;
                
                String cleanBase64 = base64Data;
                if (cleanBase64.contains(",")) {
                    cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
                }
                
                byte[] fileBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    // Android 10+ (Scoped Storage / MediaStore Downloads)
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                    values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/TaraConnect");

                    Uri uri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        OutputStream out = context.getContentResolver().openOutputStream(uri);
                        if (out != null) {
                            out.write(fileBytes);
                            out.flush();
                            out.close();
                        }

                        android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
                        handler.post(() -> {
                            Toast.makeText(context, "Downloaded: " + fileName, Toast.LENGTH_LONG).show();
                            try {
                                Intent intent = new Intent(Intent.ACTION_VIEW);
                                intent.setDataAndType(uri, mimeType);
                                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                                context.startActivity(Intent.createChooser(intent, "Open " + fileName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                            } catch (Exception ignored) {}
                        });
                    }
                } else {
                    // Android 9 and below
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    File taraDir = new File(downloadsDir, "TaraConnect");
                    if (!taraDir.exists()) taraDir.mkdirs();
                    
                    File file = new File(taraDir, fileName);
                    FileOutputStream fos = new FileOutputStream(file);
                    fos.write(fileBytes);
                    fos.flush();
                    fos.close();

                    android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
                    handler.post(() -> {
                        Toast.makeText(context, "Downloaded: " + fileName, Toast.LENGTH_LONG).show();
                        try {
                            Uri fileUri = androidx.core.content.FileProvider.getUriForFile(
                                context,
                                context.getPackageName() + ".fileprovider",
                                file
                            );
                            Intent intent = new Intent(Intent.ACTION_VIEW);
                            intent.setDataAndType(fileUri, mimeType);
                            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                            context.startActivity(Intent.createChooser(intent, "Open " + fileName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                        } catch (Exception ignored) {}
                    });
                }
            } catch (Exception e) {
                e.printStackTrace();
                android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
                handler.post(() -> Toast.makeText(context, "Download failed: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            }
        }
    }
}
