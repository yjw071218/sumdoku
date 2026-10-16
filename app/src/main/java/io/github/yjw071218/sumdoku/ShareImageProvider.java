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
 * v1.1.30 · 성과 공유 이미지 전용 읽기 전용 ContentProvider.
 * <p>캐시 폴더의 {@code share/} 아래 PNG 파일만 내보냅니다. 다른 경로·상위 폴더 접근(..)은 모두 거부합니다.
 * Play판 매니페스트에서 APK 설치용 AppFileProvider 는 제거되므로, 공유는 이 Provider 를 사용합니다.</p>
 */
public class ShareImageProvider extends ContentProvider {
    public static String authority(android.content.Context c) { return c.getPackageName() + ".shareprovider"; }

    @Override public boolean onCreate() { return true; }

    private File fileFor(Uri uri) {
        if (getContext() == null || uri == null) return null;
        String name = uri.getLastPathSegment();
        if (name == null || name.contains("..") || name.contains("/") || !name.endsWith(".png")) return null;
        File dir = new File(getContext().getCacheDir(), "share");
        File f = new File(dir, name);
        return f.isFile() ? f : null;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        File f = fileFor(uri);
        if (projection == null) projection = new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
        MatrixCursor cursor = new MatrixCursor(projection, 1);
        MatrixCursor.RowBuilder row = cursor.newRow();
        for (String col : projection) {
            if (OpenableColumns.DISPLAY_NAME.equals(col)) row.add(col, f != null ? f.getName() : "sumdoku.png");
            else if (OpenableColumns.SIZE.equals(col)) row.add(col, f != null ? f.length() : 0);
            else row.add(col, null);
        }
        return cursor;
    }

    @Override public String getType(Uri uri) { return "image/png"; }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File f = fileFor(uri);
        if (f == null) throw new FileNotFoundException("Not shareable: " + uri);
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override public Uri insert(Uri uri, ContentValues values) { return null; }
    @Override public int delete(Uri uri, String s, String[] a) { return 0; }
    @Override public int update(Uri uri, ContentValues v, String s, String[] a) { return 0; }
}
