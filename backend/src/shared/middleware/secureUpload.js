import multer from 'multer';
import { scan, Verdict } from 'pompelmi';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

const MAX_SIZE = 5 * 1024 * 1024;                       // 5 Mo
const ALLOWED_EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg']);
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/app/uploads';
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'medlink-up-')); // droits 0700

const upload = multer({
    dest: TMP_DIR,
    limits: { fileSize: MAX_SIZE, files: 1 },
    fileFilter: (req, file, cb) =>
        ALLOWED_EXT.has(path.extname(file.originalname).toLowerCase())
            ? cb(null, true)
            : cb(new Error('TYPE_NON_AUTORISE')),
});

const rm = (p) => { try { fs.unlinkSync(p); } catch { /* déjà supprimé */ } };

export function secureUpload(fieldName = 'file') {
    const single = upload.single(fieldName);
    return [
        (req, res, next) => single(req, res, (err) => {
            if (!err) return next();
            const tooBig = err.code === 'LIMIT_FILE_SIZE';
            return res.status(tooBig ? 413 : 400).json({
                error: tooBig ? 'Fichier trop volumineux (5 Mo max).' : 'Type de fichier non autorisé.',
            });
        }),
        async (req, res, next) => {
            if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni.' });
            const tmpPath = req.file.path;
            // Nom généré côté serveur : plus aucune donnée client dans le chemin
            const safeName = crypto.randomUUID() + path.extname(req.file.originalname).toLowerCase();
            const destPath = path.join(UPLOAD_DIR, safeName);
            try {
                const verdict = await scan(tmpPath, {
                    host: process.env.CLAMAV_HOST || 'clamav',
                    port: Number(process.env.CLAMAV_PORT) || 3310,
                });
                if (verdict === Verdict.Malicious) { rm(tmpPath); return res.status(400).json({ error: 'Fichier infecté détecté. Upload rejeté.' }); }
                if (verdict === Verdict.ScanError) { rm(tmpPath); return res.status(422).json({ error: 'Le scan antivirus a échoué. Upload rejeté par précaution.' }); }
                fs.copyFileSync(tmpPath, destPath);   // copy+unlink : fonctionne entre deux volumes
                rm(tmpPath);
                req.file.path = destPath;
                req.file.filename = safeName;
                next();
            } catch (err) {
                rm(tmpPath);
                console.error('Erreur scan antivirus :', err);
                return res.status(500).json({ error: 'Échec du scan antivirus.' });
            }
        },
    ];
}