package io.github.yjw071218.sumdoku;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/**
 * 인앱 APK 직접 설치를 위한 경량 ContentProvider
 * - 외부 라이브러리(AndroidX) 의존성 없이 순수 Android SDK로 동작
 * - 안드로이드 패키지 설치 관리자(PackageInstaller)에 안전하게 APK 파일 디스크립터 제공
 */
public class AppFileProvider extends ContentProvider {
    public static final String AUTHORITY = "io.github.yjw071218.sumdoku.fileprovider";

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        if (projection == null) {
            projection = new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE };
        }
        File file = getFileForUri(uri);
        MatrixCursor cursor = new MatrixCursor(projection, 1);
        MatrixCursor.RowBuilder row = cursor.newRow();
        for (String col : projection) {
            if (OpenableColumns.DISPLAY_NAME.equals(col)) {
                row.add(col, file != null ? file.getName() : "update.apk");
            } else if (OpenableColumns.SIZE.equals(col)) {
                row.add(col, file != null ? file.length() : 0);
            } else {
                row.add(col, null);
            }
        }
        return cursor;
    }

    @Override
    public String getType(Uri uri) {
        return "application/vnd.android.package-archive";
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File file = getFileForUri(uri);
        if (file == null || !file.exists()) {
            throw new FileNotFoundException("File not found: " + uri);
        }
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    private File getFileForUri(Uri uri) {
        if (getContext() == null) return null;
        String path = uri.getPath();
        if (path == null) return null;
        if (path.startsWith("/")) path = path.substring(1);
        return new File(getContext().getCacheDir(), path);
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) { return null; }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) { return 0; }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) { return 0; }
}
