import bcrypt from 'bcryptjs';
import pool from './shared/utils/db.js';
import { encrypt } from './shared/utils/encryption.js';

async function seed() {
  console.log('🌱 Initialisation de la base MedLink...');

  try {
    // 1. Création des tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL
          CHECK (role IN ('patient', 'practitioner', 'admin')),
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
        clinique_id INTEGER REFERENCES cliniques(id),
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
        statut VARCHAR(20) DEFAULT 'en_attente',
        is_read BOOLEAN DEFAULT FALSE
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
    `);

    // 2. Migrations pour les bases déjà existantes
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS consent_given BOOLEAN DEFAULT FALSE;

      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS keycloak_id UUID;

      ALTER TABLE users
        ALTER COLUMN password_hash DROP NOT NULL;

      ALTER TABLE users
        ALTER COLUMN phone TYPE TEXT;

      ALTER TABLE lab_results
        ADD COLUMN IF NOT EXISTS practitioner_id INTEGER
        REFERENCES users(id) ON DELETE SET NULL;

      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS utilisateur_id INTEGER
        REFERENCES users(id) ON DELETE CASCADE;

      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS contenu TEXT;

      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS date_envoi TIMESTAMPTZ DEFAULT NOW();

      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS statut VARCHAR(20) DEFAULT 'en_attente';
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_keycloak_id
        ON users(keycloak_id)
        WHERE keycloak_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_disponibilites_practitioner
        ON disponibilites(practitioner_id, date_debut, date_fin);

      CREATE INDEX IF NOT EXISTS idx_notifications_user
        ON notifications(utilisateur_id, is_read);
    `);

    console.log('✅ Tables et migrations vérifiées.');

    // 3. Mot de passe de démonstration
    const hash = await bcrypt.hash('password123', 10);

    // 4. Création des utilisateurs sans écraser les comptes existants
    const demoUsers = [
      {
        email: 'admin@medlink.tn',
        name: 'Admin Principal',
        role: 'admin',
        specialty: null,
        phone: '+216 71 000 000'
      },
      {
        email: 'patient@medlink.tn',
        name: 'Amine Ben Salah',
        role: 'patient',
        specialty: null,
        phone: '+216 98 123 456'
      },
      {
        email: 'ons@medlink.tn',
        name: 'Ons Ferid',
        role: 'patient',
        specialty: null,
        phone: '+216 25 943 417'
      },
      {
        email: 'sara.patient@medlink.tn',
        name: 'Sara Trabelsi',
        role: 'patient',
        specialty: null,
        phone: '+216 22 456 789'
      },
      {
        email: 'doctor@medlink.tn',
        name: 'Dr. Karim Mansouri',
        role: 'practitioner',
        specialty: 'Cardiologie',
        phone: '+216 71 234 567'
      },
      {
        email: 'pediatre@medlink.tn',
        name: 'Dr. Leila Gharbi',
        role: 'practitioner',
        specialty: 'Pédiatrie',
        phone: '+216 71 345 678'
      }
    ];

    for (const user of demoUsers) {
      await pool.query(
        `INSERT INTO users
          (email, password_hash, full_name, role, specialty, phone, consent_given)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE)
         ON CONFLICT (email) DO NOTHING`,
        [
          user.email,
          hash,
          user.name,
          user.role,
          user.specialty,
          encrypt(user.phone)
        ]
      );
    }

    // Récupération des identifiants réels, sans supposer leur ordre
    const usersResult = await pool.query(`
      SELECT id, email, role
      FROM users
      WHERE email = ANY($1::varchar[])
    `, [demoUsers.map(user => user.email)]);

    const users = Object.fromEntries(
      usersResult.rows.map(user => [user.email, user])
    );

    const admin = users['admin@medlink.tn'];
    const patient1 = users['patient@medlink.tn'];
    const patientOns = users['ons@medlink.tn'];
    const patient2 = users['sara.patient@medlink.tn'];
    const practitioner1 = users['doctor@medlink.tn'];
    const practitioner2 = users['pediatre@medlink.tn'];

    if (
      !admin || !patient1 || !patientOns || !patient2 ||
      !practitioner1 || !practitioner2
    ) {
      throw new Error('Un ou plusieurs comptes de démonstration sont introuvables.');
    }

    // Vérification des rôles avant de créer les relations
    if (
      patient1.role !== 'patient' ||
      patientOns.role !== 'patient' ||
      patient2.role !== 'patient' ||
      practitioner1.role !== 'practitioner' ||
      practitioner2.role !== 'practitioner'
    ) {
      throw new Error('Les rôles des comptes existants ne correspondent pas au seed.');
    }

    // 5. Création ou récupération des cliniques
    async function getOrCreateClinic(nom, ville, adresse, telephone) {
      const existing = await pool.query(
        `SELECT id FROM cliniques
         WHERE nom = $1 AND ville = $2
         ORDER BY id
         LIMIT 1`,
        [nom, ville]
      );

      if (existing.rows.length > 0) {
        return existing.rows[0].id;
      }

      const inserted = await pool.query(
        `INSERT INTO cliniques (nom, ville, adresse, telephone)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [nom, ville, adresse, telephone]
      );

      return inserted.rows[0].id;
    }

    const cliniqueSousse = await getOrCreateClinic(
      'Clinique El Amen',
      'Sousse',
      'Avenue Habib Bourguiba, Sousse',
      '+216 73 111 111'
    );

    const cliniqueSfax = await getOrCreateClinic(
      'Clinique Taoufik',
      'Sfax',
      'Route de Tunis, Sfax',
      '+216 74 222 222'
    );

    const cliniqueTunis = await getOrCreateClinic(
      'Clinique Pasteur',
      'Tunis',
      'Avenue Mohamed V, Tunis',
      '+216 71 333 333'
    );

    // 6. Affectation des praticiens aux cliniques
    await pool.query(
      `INSERT INTO practitioner_clinique (practitioner_id, clinique_id)
       VALUES
         ($1, $2),
         ($1, $3),
         ($4, $5)
       ON CONFLICT DO NOTHING`,
      [
        practitioner1.id,
        cliniqueSousse,
        cliniqueTunis,
        practitioner2.id,
        cliniqueSfax
      ]
    );

    // 7. Rendez-vous de démonstration
    const appointments = [
      {
        patient: patient1.id,
        practitioner: practitioner1.id,
        clinic: cliniqueSousse,
        days: 2,
        time: '09:30',
        reason: 'Contrôle tension',
        type: 'consultation',
        status: 'confirmed'
      },
      {
        patient: patient1.id,
        practitioner: practitioner1.id,
        clinic: cliniqueTunis,
        days: 5,
        time: '14:00',
        reason: 'Bilan annuel',
        type: 'consultation',
        status: 'pending'
      },
      {
        patient: patient2.id,
        practitioner: practitioner2.id,
        clinic: cliniqueSfax,
        days: 1,
        time: '10:15',
        reason: 'Vaccination enfant',
        type: 'consultation',
        status: 'confirmed'
      },
      {
        patient: patient1.id,
        practitioner: practitioner1.id,
        clinic: cliniqueSousse,
        days: -10,
        time: '11:00',
        reason: 'Suivi post-infarctus',
        type: 'suivi',
        status: 'completed'
      }
    ];

    for (const appointment of appointments) {
      await pool.query(
        `INSERT INTO appointments
          (patient_id, practitioner_id, clinique_id, appointment_date,
           appointment_time, reason, type, status)
         SELECT $1, $2, $3, CURRENT_DATE + $4, $5, $6, $7, $8
         WHERE NOT EXISTS (
           SELECT 1 FROM appointments
           WHERE patient_id = $1
             AND practitioner_id = $2
             AND appointment_date = CURRENT_DATE + $4
             AND appointment_time = $5::time
             AND reason = $6
         )`,
        [
          appointment.patient,
          appointment.practitioner,
          appointment.clinic,
          appointment.days,
          appointment.time,
          appointment.reason,
          appointment.type,
          appointment.status
        ]
      );
    }

    // 8. Dossiers médicaux
    await pool.query(
      `INSERT INTO medical_records
        (patient_id, practitioner_id, title, diagnosis, notes, record_date)
       SELECT $1, $2, $3, $4, $5, CURRENT_DATE - 10
       WHERE NOT EXISTS (
         SELECT 1 FROM medical_records
         WHERE patient_id = $1 AND title = $3
       )`,
      [
        patient1.id,
        practitioner1.id,
        'Consultation cardiologique',
        'HTA grade 1',
        'Patient stable. Traitement maintenu.'
      ]
    );

    // 9. Résultats d'examens
    const labResults = [
      {
        patient: patient1.id,
        practitioner: practitioner1.id,
        name: 'Cholestérol total',
        value: '1.95',
        unit: 'g/L',
        range: '1.50 - 2.00',
        days: 12
      },
      {
        patient: patient2.id,
        practitioner: practitioner2.id,
        name: 'Hémoglobine',
        value: '13.2',
        unit: 'g/dL',
        range: '12.0 - 16.0',
        days: 15
      }
    ];

    for (const result of labResults) {
      await pool.query(
        `INSERT INTO lab_results
          (patient_id, practitioner_id, test_name, result_value,
           unit, reference_range, status, result_date)
         SELECT $1, $2, $3, $4, $5, $6, 'normal', CURRENT_DATE - $7
         WHERE NOT EXISTS (
           SELECT 1 FROM lab_results
           WHERE patient_id = $1
             AND test_name = $3
             AND result_value = $4
         )`,
        [
          result.patient,
          result.practitioner,
          result.name,
          result.value,
          result.unit,
          result.range,
          result.days
        ]
      );
    }

    // 10. Journal d'audit
    await pool.query(
      `INSERT INTO journal_audit
        (utilisateur_id, action, ressource, adresse_ip)
       SELECT $1, 'LOGIN', 'Authentification réussie', '192.168.1.10'
       WHERE NOT EXISTS (
         SELECT 1 FROM journal_audit
         WHERE utilisateur_id = $1 AND action = 'LOGIN'
           AND ressource = 'Authentification réussie'
       )`,
      [patient1.id]
    );

    await pool.query(
      `INSERT INTO journal_audit
        (utilisateur_id, action, ressource, adresse_ip)
       SELECT $1, 'VIEW_RECORD', 'Dossier médical #1', '192.168.1.10'
       WHERE NOT EXISTS (
         SELECT 1 FROM journal_audit
         WHERE utilisateur_id = $1 AND action = 'VIEW_RECORD'
           AND ressource = 'Dossier médical #1'
       )`,
      [practitioner1.id]
    );

    // 11. Disponibilités des praticiens
    const availabilities = [
      {
        practitioner: practitioner1.id,
        clinic: cliniqueSousse,
        start: '09:00',
        end: '12:00'
      },
      {
        practitioner: practitioner1.id,
        clinic: cliniqueTunis,
        start: '14:00',
        end: '18:00'
      },
      {
        practitioner: practitioner2.id,
        clinic: cliniqueSfax,
        start: '08:30',
        end: '12:30'
      }
    ];

    for (const availability of availabilities) {
      await pool.query(
        `INSERT INTO disponibilites
          (practitioner_id, clinique_id, date_debut, date_fin,
           heure_debut, heure_fin, type)
         SELECT $1, $2, CURRENT_DATE, CURRENT_DATE + 30, $3, $4, 'disponible'
         WHERE NOT EXISTS (
           SELECT 1 FROM disponibilites
           WHERE practitioner_id = $1
             AND clinique_id = $2
             AND date_debut = CURRENT_DATE
             AND heure_debut = $3::time
         )`,
        [
          availability.practitioner,
          availability.clinic,
          availability.start,
          availability.end
        ]
      );
    }

    console.log('✅ Seed terminé.');
    console.log('🔑 Comptes de démonstration (mot de passe initial : password123) :');
    console.log('Admin       : admin@medlink.tn');
    console.log('Patient     : patient@medlink.tn (Amine)');
    console.log('Patient     : ons@medlink.tn (Ons)');
    console.log('Patient     : sara.patient@medlink.tn (Sara)');
    console.log('Praticien   : doctor@medlink.tn (Karim)');
    console.log('Praticienne : pediatre@medlink.tn (Leila)');
    console.log('ℹ️ Les comptes déjà existants ne voient pas leur mot de passe ni leur consentement écrasés.');

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Échec du seed :', err);
    await pool.end();
    process.exit(1);
  }
}

seed();