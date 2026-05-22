import toast from 'react-hot-toast';

/**
 * Force-download a remote file. The HTML `download` attribute is ignored by
 * browsers for cross-origin URLs (which Supabase Storage URLs are), so we
 * fetch the file as a blob, then trigger a synthetic anchor click on an
 * object URL — this works regardless of origin.
 */
export async function downloadFile(url, filename = 'download') {
    try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();

        // Revoke after the click has been processed.
        setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (err) {
        toast.error(`Download failed: ${err.message}`);
    }
}

/**
 * Save an in-memory string as a downloadable file. Used for "download message"
 * actions where the text content lives in JS and never came from a URL.
 */
export function downloadText(text, filename = 'message.txt') {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
