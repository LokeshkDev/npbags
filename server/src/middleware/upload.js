const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isR2Configured, uploadToR2, deleteFromR2 } = require('../services/r2Service');

// Use memory storage when R2 is configured so we can stream directly to Cloudflare
// Otherwise use diskStorage as fallback
const storage = isR2Configured
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => {
        let folder = 'products';
        if (req.baseUrl.includes('banners') || req.body.folder === 'banners') {
          folder = 'banners';
        } else if (req.baseUrl.includes('blogs') || req.body.folder === 'blogs') {
          folder = 'blogs';
        } else if (req.baseUrl.includes('cms') || req.body.folder === 'cms') {
          folder = 'cms';
        }

        const dest = path.resolve(__dirname, `../../uploads/${folder}`);
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        cb(null, dest);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${uniqueSuffix}${ext}`);
      }
    });

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPEG, PNG, WebP, SVG, GIF) are allowed.'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter
});

let sharp = null;
try {
  sharp = require('../../../client/website/node_modules/sharp');
} catch (e) {
  try {
    sharp = require('sharp');
  } catch (err) {
    sharp = null;
  }
}

/**
 * Helper to process an uploaded file: uploads to Cloudflare R2 if configured,
 * or returns local /uploads path if using disk fallback.
 * @param {Object} file - Express multer file object
 * @param {string} folder - 'products', 'banners', 'cms', 'blogs'
 * @returns {Promise<string>} Target public URL or path
 */
async function processUploadedFile(file, folder = 'products') {
  if (!file) return null;

  if (isR2Configured && file.buffer) {
    let uploadBuf = file.buffer;
    let mimeType = file.mimetype;
    let ext = path.extname(file.originalname).toLowerCase();

    // Automatically optimize images down from MB to KB without losing resolution
    if (sharp && ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      try {
        let pipeline = sharp(file.buffer);
        const meta = await pipeline.metadata();
        const maxDim = (folder === 'banners' || folder === 'cms') ? 1800 : 1200;
        if (meta.width && meta.width > maxDim) {
          pipeline = pipeline.resize({ width: maxDim, withoutEnlargement: true });
        }
        uploadBuf = await pipeline.webp({ quality: 82 }).toBuffer();
        mimeType = 'image/webp';
        ext = '.webp';
      } catch (err) {
        console.warn('[Upload] Image optimization skipped:', err.message);
      }
    }

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const key = `${folder}/${uniqueSuffix}${ext}`;
    return await uploadToR2(uploadBuf, key, mimeType);
  }

  // Fallback to local disk
  if (file.filename) {
    return `/uploads/${folder}/${file.filename}`;
  }

  return null;
}

/**
 * Delete a file whether stored in Cloudflare R2 or local disk
 * @param {string} fileUrlOrPath
 */
async function deleteUploadedFile(fileUrlOrPath) {
  if (!fileUrlOrPath || typeof fileUrlOrPath !== 'string') return;

  // Safety check: do not delete if file is still referenced anywhere in the DB
  try {
    const { query } = require('../config/db');
    const [imgRef] = await query('SELECT COUNT(*) AS cnt FROM product_images WHERE image_url = ?', [fileUrlOrPath]);
    const [varRef] = await query('SELECT COUNT(*) AS cnt FROM product_variants WHERE image_url = ?', [fileUrlOrPath]);
    if ((imgRef && imgRef.cnt > 0) || (varRef && varRef.cnt > 0)) {
      console.log(`[Upload] Skipping deletion of ${fileUrlOrPath} — still referenced in database`);
      return;
    }
  } catch (dbErr) {
    // If DB check fails, continue
  }

  if (isR2Configured && (fileUrlOrPath.startsWith('http://') || fileUrlOrPath.startsWith('https://'))) {
    await deleteFromR2(fileUrlOrPath);
    return;
  }

  if (fileUrlOrPath.startsWith('/uploads/')) {
    const filePath = path.resolve(__dirname, '../../', fileUrlOrPath.replace(/^\//, ''));
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`[Upload] Failed to delete file: ${filePath}`, err.message);
      }
    }
  }
}

module.exports = {
  upload,
  processUploadedFile,
  deleteUploadedFile,
  isR2Configured
};
