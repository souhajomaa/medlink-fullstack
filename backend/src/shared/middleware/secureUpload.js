import multer from 'multer';
import { scan, Verdict } from 'pompelmi';
import fs from 'fs';
import path from 'path';

const upload = multer({ dest: '/tmp/uploads/' });

export function secureUpload(fieldName = 'file') {
    return [
        upload.single(fieldName),
        async (req, res, next) => {
            if (!req.file) {
                return res.status(400).json({ error: 'Aucun fichier fourni.' });
            }

            const tmpPath = req.file.path;
            const destPath = path.join('/var/app/uploads', req.file.originalname);

            try {
                const verdict = await scan(tmpPath, {
                    host: process.env.CLAMAV_HOST || 'clamav',
                    port: Number(process.env.CLAMAV_PORT) || 3310,
                });

                if (verdict === Verdict.Malicious) {
                    fs.unlinkSync(tmpPath);
                    return res.status(400).json({ error: 'Fichier infecté détecté. Upload rejeté.' });
                }

                if (verdict === Verdict.ScanError) {
                    fs.unlinkSync(tmpPath);
                    return res.status(422).json({ error: 'Le scan antivirus a échoué. Upload rejeté par précaution.' });
                }

                // Verdict.Clean : on déplace le fichier vers le stockage permanent
                fs.renameSync(tmpPath, destPath);
                req.file.path = destPath;
                next();
            } catch (err) {
                if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
                console.error('Erreur scan antivirus :', err);
                return res.status(500).json({ error: 'Échec du scan antivirus.' });
            }
        },
    ];
}