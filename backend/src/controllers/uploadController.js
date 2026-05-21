const crypto = require('crypto');
const supabase = require('../config/supabase');

const BUCKET = 'attachments';

/**
 * POST /api/uploads — multipart/form-data with field "file".
 * Streams the file to Supabase Storage and returns its public URL + metadata.
 */
exports.uploadFile = async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });

        // Filename: <userId>/<randomHex>-<originalName>
        const safeName = (file.originalname || 'file').replace(/[^\w.\- ]+/g, '_').slice(0, 80);
        const objectPath = `${req.user.id}/${crypto.randomBytes(8).toString('hex')}-${safeName}`;

        const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(objectPath, file.buffer, {
                contentType: file.mimetype,
                upsert: false,
            });
        if (upErr) {
            // Bucket missing? Tell the caller — most setup mistakes land here.
            return res.status(500).json({
                error: `Upload failed: ${upErr.message}. Did you run supabase/migration.sql to create the 'attachments' bucket?`,
            });
        }

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
        res.status(201).json({
            url: pub.publicUrl,
            type: file.mimetype,
            name: file.originalname,
            size: file.size,
        });
    } catch (err) {
        next(err);
    }
};
