import bcrypt from 'bcryptjs';
import pool from './shared/utils/db.js';
import { encrypt } from './shared/utils/encryption.js';

async function seed() {
    console.log('🌱 Début du seeding de la base MedLink...');

    try {
        await pool.query(`
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS journal_audit CASCADE;
      DROP TABLE IF EXISTS lab_results CASCADE;
      DROP TABLE IF EXISTS medical_records CASCADE;
      DROP TABLE IF EXISTS appointments CASCADE;
      DROP TABLE IF EXISTS disponibilites CASCADE;
      DROP TABLE IF EXISTS practitioner_clinique CASCADE;
      DROP TABLE IF EXISTS cliniques CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

        console.log('🧹 Anciennes tables supprimées.');

        // 1. Création des tables
        await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'practitioner', 'admin')),
        specialty VARCHAR(100),
        phone TEXT,
        consent_given BOOLEAN DEFAULT FALSE,
        keycloak_id UUID UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS cliniques (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(255) NOT NULL,
        ville VARCHAR(100) NOT NULL,
        adresse TEXT,
        telephone VARCHAR(30)
      );

      CREATE TABLE IF NOT EXISTS practitioner_clinique (
        practitioner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        clinique_id INTEGER REFERENCES cliniques(id) ON DELETE CASCADE,
        PRIMARY KEY (practitioner_id, clinique_id)
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        practitioner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        clinique_id INTEGER REFERENCES cliniques(id) ON DELETE SET NULL,
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        reason TEXT,
        type VARCHAR(50) DEFAULT 'consultation',
        status VARCHAR(20) DEFAULT 'pending'
          CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS medical_records (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        practitioner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        diagnosis TEXT,
        notes TEXT,
        record_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS lab_results (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        practitioner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        test_name VARCHAR(255) NOT NULL,
        result_value VARCHAR(100),
        unit VARCHAR(50),
        reference_range VARCHAR(100),
        status VARCHAR(20) DEFAULT 'normal'
          CHECK (status IN ('normal', 'abnormal', 'critical')),
        result_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS journal_audit (
        id SERIAL PRIMARY KEY,
        utilisateur_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        ressource VARCHAR(255),
        date_heure TIMESTAMPTZ DEFAULT NOW(),
        adresse_ip VARCHAR(45)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        utilisateur_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        contenu TEXT,
        date_envoi TIMESTAMPTZ DEFAULT NOW(),
        statut VARCHAR(20) DEFAULT 'en_attente'
      );

      CREATE TABLE IF NOT EXISTS disponibilites (
        id SERIAL PRIMARY KEY,
        practitioner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        clinique_id INTEGER NOT NULL REFERENCES cliniques(id) ON DELETE CASCADE,
        date_debut DATE NOT NULL,
        date_fin DATE NOT NULL,
        heure_debut TIME NOT NULL,
        heure_fin TIME NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'disponible'
          CHECK (type IN ('disponible', 'bloque', 'absence')),
        motif TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT chk_dates CHECK (date_fin >= date_debut),
        CONSTRAINT chk_heures CHECK (heure_fin > heure_debut)
      );

      CREATE INDEX IF NOT EXISTS idx_appointments_patient
        ON appointments (patient_id, appointment_date);

      CREATE INDEX IF NOT EXISTS idx_appointments_practitioner
        ON appointments (practitioner_id, appointment_date);

      CREATE INDEX IF NOT EXISTS idx_disponibilites_practitioner
        ON disponibilites (practitioner_id, date_debut, date_fin);
    `);

        console.log('✅ Tables créées.');

        const password = 'Medlink@2026!';
        const hash = await bcrypt.hash(password, 10);

        // 2. Cliniques
        const cliniques = await pool.query(`
      INSERT INTO cliniques (nom, ville, adresse, telephone)
      VALUES
        ('Clinique El Amen', 'Sousse', 'Avenue Habib Bourguiba, Sousse', '+216 73 111 111'),
        ('Clinique Taoufik', 'Sfax', 'Route de Tunis, Sfax', '+216 74 222 222'),
        ('Clinique Pasteur', 'Tunis', 'Avenue Mohamed V, Tunis', '+216 71 333 333')
      RETURNING id, nom, ville
    `);

        const cliniqueSousse = cliniques.rows[0].id;
        const cliniqueSfax = cliniques.rows[1].id;
        const cliniqueTunis = cliniques.rows[2].id;

        // 3. Utilisateurs
        const users = await pool.query(
            `
      INSERT INTO users
        (email, password_hash, full_name, role, specialty, phone, consent_given)
      VALUES
        ('admin@medlink.tn', $1, 'Admin Principal', 'admin', NULL, $2, TRUE),
        ('patient@medlink.tn', $1, 'Amine Ben Salah', 'patient', NULL, $3, TRUE),
        ('sara.patient@medlink.tn', $1, 'Sara Trabelsi', 'patient', NULL, $4, TRUE),
        ('doctor@medlink.tn', $1, 'Dr. Karim Mansouri', 'practitioner', 'Cardiologie', $5, TRUE),
        ('pediatre@medlink.tn', $1, 'Dr. Leila Gharbi', 'practitioner', 'Pédiatrie', $6, TRUE)
      RETURNING id, email, role
      `,
            [
                hash,
                encrypt('+216 71 000 000'),
                encrypt('+216 98 123 456'),
                encrypt('+216 22 456 789'),
                encrypt('+216 71 234 567'),
                encrypt('+216 71 345 678'),
            ]
        );

        await pool.query(`
      UPDATE users u
      SET keycloak_id = v.kid::uuid
      FROM (
        VALUES
          ('admin@medlink.tn',        '11111111-1111-4111-8111-000000000001'),
          ('patient@medlink.tn',      '11111111-1111-4111-8111-000000000002'),
          ('sara.patient@medlink.tn', '11111111-1111-4111-8111-000000000003'),
          ('doctor@medlink.tn',       '11111111-1111-4111-8111-000000000004'),
          ('pediatre@medlink.tn',     '11111111-1111-4111-8111-000000000005')
      ) AS v(email, kid)
      WHERE u.email = v.email
    `);

        const patient1 = users.rows[1].id;
        const patient2 = users.rows[2].id;
        const practitioner1 = users.rows[3].id;
        const practitioner2 = users.rows[4].id;

        // 4. Affectation praticiens ↔ cliniques
        await pool.query(
            `
      INSERT INTO practitioner_clinique (practitioner_id, clinique_id)
      VALUES
        ($1, $2),
        ($1, $3),
        ($4, $5)
      `,
            [
                practitioner1,
                cliniqueSousse,
                cliniqueTunis,
                practitioner2,
                cliniqueSfax,
            ]
        );

        // 5. Rendez-vous
        await pool.query(
            `
      INSERT INTO appointments
        (
          patient_id,
          practitioner_id,
          clinique_id,
          appointment_date,
          appointment_time,
          reason,
          type,
          status
        )
      VALUES
        ($1, $3, $5, CURRENT_DATE + 2, '09:30', 'Contrôle tension', 'consultation', 'confirmed'),
        ($1, $3, $6, CURRENT_DATE + 5, '14:00', 'Bilan annuel', 'consultation', 'pending'),
        ($2, $4, $7, CURRENT_DATE + 1, '10:15', 'Vaccination enfant', 'consultation', 'confirmed'),
        ($1, $3, $5, CURRENT_DATE - 10, '11:00', 'Suivi post-infarctus', 'suivi', 'completed')
      `,
            [
                patient1,
                patient2,
                practitioner1,
                practitioner2,
                cliniqueSousse,
                cliniqueTunis,
                cliniqueSfax,
            ]
        );

        // 6. Dossiers médicaux
        await pool.query(
            `
      INSERT INTO medical_records
        (patient_id, practitioner_id, title, diagnosis, notes, record_date)
      VALUES
        ($1, $2, 'Consultation cardiologique', 'HTA grade 1', 'Patient stable. Traitement maintenu.', CURRENT_DATE - 10),
        ($3, $4, 'Consultation pédiatrique', 'Vaccination de routine', 'Aucune anomalie détectée.', CURRENT_DATE - 7)
      `,
            [patient1, practitioner1, patient2, practitioner2]
        );

        // 7. Résultats d'examens
        await pool.query(
            `
      INSERT INTO lab_results
        (
          patient_id,
          practitioner_id,
          test_name,
          result_value,
          unit,
          reference_range,
          status,
          result_date
        )
      VALUES
        ($1, $3, 'Cholestérol total', '1.95', 'g/L', '1.50 - 2.00', 'normal', CURRENT_DATE - 12),
        ($2, $4, 'Hémoglobine', '13.2', 'g/dL', '12.0 - 16.0', 'normal', CURRENT_DATE - 15)
      `,
            [patient1, patient2, practitioner1, practitioner2]
        );

        // 8. Journal d'audit
        await pool.query(
            `
      INSERT INTO journal_audit
        (utilisateur_id, action, ressource, adresse_ip)
      VALUES
        ($1, 'LOGIN', 'Authentification réussie', '192.168.1.10'),
        ($2, 'VIEW_RECORD', 'Dossier médical #1', '192.168.1.11')
      `,
            [patient1, practitioner1]
        );

        // 9. Notifications
        await pool.query(
            `
      INSERT INTO notifications
        (utilisateur_id, type, contenu, statut)
      VALUES
        ($1, 'appointment_reminder', 'Votre rendez-vous approche.', 'en_attente'),
        ($2, 'appointment_confirmed', 'Votre rendez-vous est confirmé.', 'en_attente')
      `,
            [patient1, patient2]
        );

        // 10. Disponibilités
        await pool.query(
            `
      INSERT INTO disponibilites
        (
          practitioner_id,
          clinique_id,
          date_debut,
          date_fin,
          heure_debut,
          heure_fin,
          type
        )
      VALUES
        ($1, $2, CURRENT_DATE, CURRENT_DATE + 30, '09:00', '12:00', 'disponible'),
        ($1, $3, CURRENT_DATE, CURRENT_DATE + 30, '14:00', '18:00', 'disponible'),
        ($4, $5, CURRENT_DATE, CURRENT_DATE + 30, '08:30', '12:30', 'disponible')
      `,
            [
                practitioner1,
                cliniqueSousse,
                cliniqueTunis,
                practitioner2,
                cliniqueSfax,
            ]
        );

        console.log('✅ Seed terminé avec succès !\n');
        console.log(`🔑 Comptes de démo (Mot de passe : ${password}) :`);
        console.log('  🔒 Admin       : admin@medlink.tn');
        console.log('  👤 Patient     : patient@medlink.tn      (Amine)');
        console.log('  👤 Patient     : sara.patient@medlink.tn (Sara)');
        console.log('  👨‍⚕️ Praticien  : doctor@medlink.tn       (Karim — Cardiologie — Sousse/Tunis)');
        console.log('  👩‍⚕️ Praticien  : pediatre@medlink.tn     (Leila — Pédiatrie — Sfax)\n');

        console.log('📌 Patientèle seed :');
        console.log('  • Karim → Amine');
        console.log('  • Leila → Sara\n');

        process.exit(0);
    } catch (err) {
        console.error('❌ Échec du seed:', err);
        process.exit(1);
    }
}

seed();