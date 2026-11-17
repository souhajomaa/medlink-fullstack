import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/context/AuthContext';
import { api } from '../../../shared/api/axiosConfig';
import logo from '../../../shared/assets/logo-medlink.jpg';
import { Shell, Field, InputShell, Ic, TEAL } from '../components/AuthUi';

// Inscription praticien : le compte est créé directement (Keycloak + profil MedLink).
// Après vérification de l'email, le praticien se connecte et arrive sur son dashboard (/app).

// --- Règles identiques à backend/src/shared/utils/validators.js -------------
const NAME_REGEX = /^[\p{L}][\p{L}\p{M}' -]{1,49}$/u;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TN_PHONE_REGEX = /^[24579]\d{7}$/;
const ORDER_NUMBER_REGEX = /^[A-Za-z0-9][A-Za-z0-9 ./-]{2,29}$/;

function normalizePhone(raw) {
  let digits = raw.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+216')) digits = digits.slice(4);
  else if (digits.startsWith('00216')) digits = digits.slice(5);
  else if (digits.startsWith('216') && digits.length === 11) digits = digits.slice(3);
  return TN_PHONE_REGEX.test(digits) ? `+216${digits}` : null;
}

const PASSWORD_CHECKS = [
  { id: 'len', label: 'Au moins 12 caractères', test: (p) => p.length >= 12 && p.length <= 128 },
  { id: 'lower', label: 'Une minuscule', test: (p) => /\p{Ll}/u.test(p) },
  { id: 'upper', label: 'Une majuscule', test: (p) => /\p{Lu}/u.test(p) },
  { id: 'digit', label: 'Un chiffre', test: (p) => /\p{Nd}/u.test(p) },
  { id: 'special', label: 'Un caractère spécial', test: (p) => /[^\p{L}\p{N}]/u.test(p) },
];

function strengthOf(password) {
  const score = PASSWORD_CHECKS.filter((c) => c.test(password)).length;
  if (!password) return { score: 0, label: '', color: 'bg-slate-200', text: 'text-slate-400' };
  if (score <= 2) return { score, label: 'Faible', color: 'bg-red-500', text: 'text-red-600' };
  if (score <= 4) return { score, label: 'Moyen', color: 'bg-amber-500', text: 'text-amber-600' };
  return { score, label: 'Fort', color: 'bg-emerald-500', text: 'text-emerald-600' };
}

function validate(v) {
  const errors = {};
  if (!NAME_REGEX.test(v.firstName.trim())) errors.firstName = 'Prénom invalide';
  if (!NAME_REGEX.test(v.lastName.trim())) errors.lastName = 'Nom invalide';

  const email = v.email.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) errors.email = 'Adresse email invalide';
  if (!normalizePhone(v.phone)) errors.phone = 'Numéro tunisien invalide (ex. 22 123 456)';

  if (!PASSWORD_CHECKS.every((c) => c.test(v.password)) || v.password.toLowerCase() === email) {
    errors.password = 'Le mot de passe ne respecte pas toutes les règles';
  }
  if (v.confirm !== v.password) errors.confirm = 'Les mots de passe ne correspondent pas';

  if (!v.specialty) errors.specialty = 'Veuillez choisir une spécialité';
  if (!v.cliniqueId) errors.cliniqueId = 'Veuillez choisir une clinique';
  if (!ORDER_NUMBER_REGEX.test(v.orderNumber.trim())) errors.orderNumber = "Numéro d'inscription à l'Ordre invalide";
  if (!v.acceptTerms) {
    errors.acceptTerms = "Vous devez accepter les conditions d'utilisation et la politique de confidentialité";
  }
  return errors;
}

const INITIAL = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirm: '',
  specialty: '',
  cliniqueId: '',
  orderNumber: '',
  acceptTerms: false,
};

const PANEL = {
  title: 'Rejoignez le réseau MedLink',
  highlight: 'et gérez vos consultations.',
  text: 'Créez votre compte praticien et accédez à votre espace professionnel.',
  features: [
    ['calendar', 'Agenda et rendez-vous centralisés'],
    ['file', 'Accès sécurisé aux dossiers de vos patients'],
    ['shield', 'Données de santé protégées et confidentielles'],
  ],
};

export default function SignupPractitioner() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState(INITIAL);
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [options, setOptions] = useState({ specialties: [], cliniques: [] });
  const [optionsError, setOptionsError] = useState(false);

  // Déjà connecté : direction le dashboard (/app affiche l'espace selon le rôle).
  useEffect(() => {
    if (!loading && user) navigate('/app', { replace: true });
  }, [user, loading, navigate]);

  // Listes des spécialités et des cliniques (fournies par le backend).
  useEffect(() => {
    let cancelled = false;
    api.auth
      .practitionerOptions()
      .then((data) => !cancelled && setOptions(data))
      .catch(() => !cancelled && setOptionsError(true));
    return () => { cancelled = true; };
  }, []);

  const clientErrors = useMemo(() => validate(values), [values]);
  const errorFor = (name) => (touched[name] && clientErrors[name]) || serverErrors[name] || '';

  const set = (name) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setValues((prev) => ({ ...prev, [name]: value }));
    setServerErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
    setFormError('');
  };
  const blur = (name) => () => setTouched((prev) => ({ ...prev, [name]: true }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setTouched(Object.fromEntries(Object.keys(INITIAL).map((k) => [k, true])));
    if (Object.keys(clientErrors).length > 0) return;

    setSubmitting(true);
    try {
      await api.auth.registerPractitioner({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone,
        password: values.password,
        specialty: values.specialty,
        cliniqueId: Number(values.cliniqueId),
        orderNumber: values.orderNumber.trim(),
        acceptTerms: values.acceptTerms,
      });
      setSuccess(values.email.trim().toLowerCase());
      setValues(INITIAL); // le mot de passe ne reste pas en mémoire dans le formulaire
    } catch (err) {
      if (err.status === 400 && err.fields && Object.keys(err.fields).length) {
        setServerErrors(err.fields);
        setFormError('Veuillez corriger les champs signalés.');
      } else if (err.status === 429) {
        setFormError('Trop de tentatives. Patientez quelques minutes avant de réessayer.');
      } else {
        setFormError(err.message || 'Inscription impossible pour le moment.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // --- Écran de succès ------------------------------------------------------
  if (success) {
    return (
      <Shell panel={PANEL}>
        <div className="text-center lg:text-left">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-container text-success lg:mx-0">
            <Ic name="check" size={30} />
          </div>
          <h1 className="mb-3 text-3xl font-extrabold tracking-tight">Compte créé</h1>
          <p className="mb-2 text-slate-500">Votre compte praticien a été créé. Un email de confirmation a été envoyé à</p>
          <p className="mb-5 break-all text-lg font-semibold">{success}</p>
          <p className="mb-8 text-slate-500">
            Cliquez sur le lien reçu pour confirmer votre adresse, puis connectez-vous pour accéder à votre espace.
          </p>
          <button
            type="button"
            onClick={() => login().catch(console.error)}
            className={`flex h-14 w-full items-center justify-center gap-2 rounded-xl font-bold text-white shadow-lg shadow-[#028f82]/25 transition ${TEAL}`}
          >
            Aller à la connexion <Ic name="arrow" size={18} />
          </button>
        </div>
      </Shell>
    );
  }

  // --- Formulaire -----------------------------------------------------------
  const border = (name) =>
    errorFor(name)
      ? 'border-error focus:border-error focus:ring-error/15'
      : 'border-slate-300 focus:border-[#028f82] focus:ring-[#028f82]/15';
  const fieldClass = (name, extra = '') =>
    `h-[52px] w-full rounded-xl border bg-white pl-12 text-[15px] text-on-surface placeholder:text-slate-400 transition focus:outline-none focus:ring-4 ${extra} ${border(name)}`;

  const inputProps = (name, extra = {}) => ({
    id: name,
    name,
    value: values[name],
    onChange: set(name),
    onBlur: blur(name),
    'aria-invalid': errorFor(name) ? 'true' : 'false',
    'aria-describedby': errorFor(name) ? `${name}-error` : undefined,
    className: fieldClass(name, 'pr-4'),
    ...extra,
  });

  const chevron = <span className="text-slate-400"><Ic name="chevron" size={18} /></span>;

  const strength = strengthOf(values.password);
  const confirmOk = values.confirm !== '' && values.confirm === values.password;
  const eyeButton = (
    <button
      type="button"
      onClick={() => setShowPassword((s) => !s)}
      className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-on-surface"
      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
    >
      <Ic name={showPassword ? 'eyeOff' : 'eye'} size={19} />
    </button>
  );

  return (
    <Shell panel={PANEL}>
      <div className="mb-6 flex items-center gap-3 lg:hidden">
        <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
          <img src={logo} alt="MedLink" className="h-9 w-9 object-contain" />
        </span>
        <span className="font-display text-2xl font-extrabold tracking-tight">MedLink</span>
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight sm:text-[2rem]">Créer un compte praticien</h1>
      <p className="mb-7 mt-2 text-slate-500">
        Renseignez vos informations professionnelles pour accéder à votre espace praticien.
      </p>

      {optionsError && (
        <div role="alert" className="mb-5 rounded-xl bg-error-container px-4 py-3 text-sm font-medium text-error">
          Impossible de charger les spécialités et les cliniques. Rechargez la page.
        </div>
      )}
      {formError && (
        <div role="alert" className="mb-5 rounded-xl bg-error-container px-4 py-3 text-sm font-medium text-error">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="firstName" label="Prénom" error={errorFor('firstName')}>
            <InputShell icon="user">
              <input {...inputProps('firstName', { type: 'text', autoComplete: 'given-name' })} />
            </InputShell>
          </Field>
          <Field id="lastName" label="Nom" error={errorFor('lastName')}>
            <InputShell icon="user">
              <input {...inputProps('lastName', { type: 'text', autoComplete: 'family-name' })} />
            </InputShell>
          </Field>
        </div>

        <Field id="email" label="Email professionnel" error={errorFor('email')}>
          <InputShell icon="mail">
            <input {...inputProps('email', { type: 'email', autoComplete: 'email', placeholder: 'nom@clinique.tn' })} />
          </InputShell>
        </Field>

        <Field id="phone" label="Téléphone" error={errorFor('phone')}>
          <div className="flex">
            <span className="inline-flex h-[52px] items-center gap-2 rounded-l-xl border border-r-0 border-slate-300 bg-slate-100 px-4 text-[15px] font-semibold text-slate-600">
              <Ic name="phone" size={17} /> +216
            </span>
            <input
              {...inputProps('phone', {
                type: 'tel',
                autoComplete: 'tel-national',
                placeholder: '22 123 456',
                className: `h-[52px] w-full rounded-r-xl border bg-white px-4 text-[15px] text-on-surface placeholder:text-slate-400 transition focus:outline-none focus:ring-4 ${border('phone')}`,
              })}
            />
          </div>
        </Field>

        <Field id="password" label="Mot de passe" error={errorFor('password')}>
          <InputShell icon="lock" right={eyeButton}>
            <input
              {...inputProps('password', {
                type: showPassword ? 'text' : 'password',
                autoComplete: 'new-password',
                maxLength: 128,
                className: fieldClass('password', 'pr-14'),
              })}
            />
          </InputShell>

          {values.password && (
            <div className="mt-3 flex items-center gap-3" aria-live="polite">
              <div className="flex flex-1 gap-1.5" aria-hidden="true">
                {PASSWORD_CHECKS.map((c, i) => (
                  <span key={c.id} className={`h-1.5 flex-1 rounded-full ${i < strength.score ? strength.color : 'bg-slate-200'}`} />
                ))}
              </div>
              <span className={`w-12 text-right text-xs font-bold ${strength.text}`}>{strength.label}</span>
            </div>
          )}

          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Règles du mot de passe">
            {PASSWORD_CHECKS.map((c) => {
              const ok = c.test(values.password);
              return (
                <li
                  key={c.id}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                    ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {ok ? <Ic name="check" size={12} /> : <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-slate-400" />}
                  {c.label}
                </li>
              );
            })}
          </ul>
        </Field>

        <Field id="confirm" label="Confirmer le mot de passe" error={errorFor('confirm')}>
          <InputShell
            icon="lock"
            right={confirmOk ? <span className="text-emerald-500"><Ic name="check" size={20} /></span> : null}
          >
            <input
              {...inputProps('confirm', {
                type: showPassword ? 'text' : 'password',
                autoComplete: 'new-password',
                maxLength: 128,
                className: fieldClass('confirm', 'pr-12'),
              })}
            />
          </InputShell>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="specialty" label="Spécialité" error={errorFor('specialty')}>
            <InputShell icon="pulse" right={chevron} passive>
              <select {...inputProps('specialty', { className: fieldClass('specialty', 'appearance-none pr-10') })}>
                <option value="">Choisir…</option>
                {options.specialties.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </InputShell>
          </Field>

          <Field id="cliniqueId" label="Clinique d'exercice" error={errorFor('cliniqueId')}>
            <InputShell icon="building" right={chevron} passive>
              <select {...inputProps('cliniqueId', { className: fieldClass('cliniqueId', 'appearance-none pr-10') })}>
                <option value="">Choisir…</option>
                {options.cliniques.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom} — {c.ville}</option>
                ))}
              </select>
            </InputShell>
          </Field>
        </div>

        <Field id="orderNumber" label="N° d'inscription à l'Ordre" error={errorFor('orderNumber')}>
          <InputShell icon="badge">
            <input {...inputProps('orderNumber', { type: 'text', autoComplete: 'off', maxLength: 30, placeholder: 'Ex. 12345' })} />
          </InputShell>
        </Field>

        <div>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-slate-600">
            <input
              type="checkbox"
              name="acceptTerms"
              checked={values.acceptTerms}
              onChange={set('acceptTerms')}
              onBlur={blur('acceptTerms')}
              aria-describedby={errorFor('acceptTerms') ? 'acceptTerms-error' : undefined}
              className="mt-0.5 h-5 w-5 flex-none rounded border-slate-300 text-[#028f82] focus:ring-[#028f82]"
            />
            <span>
              J'accepte les <strong className="font-semibold text-[#028f82]">conditions d'utilisation</strong> et la{' '}
              <strong className="font-semibold text-[#028f82]">politique de confidentialité</strong> de MedLink.
            </span>
          </label>
          {errorFor('acceptTerms') && (
            <p id="acceptTerms-error" role="alert" className="mt-1.5 text-xs font-medium text-error">
              {errorFor('acceptTerms')}
            </p>
          )}
        </div>

        <div>
          <button
            type="submit"
            disabled={submitting}
            className={`flex h-14 w-full items-center justify-center gap-2 rounded-xl font-bold text-white shadow-lg shadow-[#028f82]/25 transition disabled:cursor-wait disabled:opacity-70 ${TEAL}`}
          >
            {submitting ? 'Création du compte…' : (<>Créer mon compte <Ic name="arrow" size={18} /></>)}
          </button>
          <p className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Ic name="lock" size={13} /> Un email de vérification sera envoyé à l'adresse indiquée.
          </p>
        </div>
      </form>

      <div className="mt-7 space-y-2 border-t border-slate-100 pt-6 text-center text-slate-500">
        <p>
          Vous avez déjà un compte ?{' '}
          <button type="button" onClick={() => login().catch(console.error)} className="font-bold text-[#028f82] hover:underline">
            Se connecter
          </button>
        </p>
        <p>
          Vous êtes patient ?{' '}
          <Link to="/signup" className="font-bold text-[#028f82] hover:underline">Créer un compte patient</Link>
        </p>
      </div>
    </Shell>
  );
}
