// Validation côté serveur des données d'inscription (US-01, US-42).
// Les règles de mot de passe reproduisent la politique Keycloak du realm :
// 12 caractères minimum, majuscule, minuscule, chiffre, caractère spécial.

const NAME_REGEX = /^[\p{L}][\p{L}\p{M}' -]{1,49}$/u;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TN_PHONE_REGEX = /^[24579]\d{7}$/; // mobiles 2/4/5/9, fixes 7

// Accepte 22123456, 22 123 456, +21622123456, 0021622123456, 21622123456.
// Retourne +216XXXXXXXX ou null si le numéro est invalide.
export function normalizePhone(raw) {
  if (typeof raw !== 'string') return null;

  let digits = raw.replace(/[\s.\-()]/g, '');

  if (digits.startsWith('+216')) digits = digits.slice(4);
  else if (digits.startsWith('00216')) digits = digits.slice(5);
  else if (digits.startsWith('216') && digits.length === 11) digits = digits.slice(3);

  return TN_PHONE_REGEX.test(digits) ? `+216${digits}` : null;
}

export function isPasswordCompliant(password, email = '') {
  if (typeof password !== 'string') return false;
  if (password.length < 12 || password.length > 128) return false;
  if (!/\p{Ll}/u.test(password)) return false;
  if (!/\p{Lu}/u.test(password)) return false;
  if (!/\p{Nd}/u.test(password)) return false;
  if (!/[^\p{L}\p{N}]/u.test(password)) return false;
  if (email && password.toLowerCase() === email.toLowerCase()) return false;
  return true;
}

export const PASSWORD_RULES_MESSAGE =
  'Le mot de passe doit contenir au moins 12 caractères, une majuscule, ' +
  'une minuscule, un chiffre et un caractère spécial.';

export function validateRegistration(body = {}) {
  const errors = {};

  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const phone = normalizePhone(body.phone);

  if (!NAME_REGEX.test(firstName)) errors.firstName = 'Prénom invalide';
  if (!NAME_REGEX.test(lastName)) errors.lastName = 'Nom invalide';

  if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) {
    errors.email = 'Adresse email invalide';
  }

  if (!phone) {
    errors.phone = 'Numéro de téléphone tunisien invalide (ex. +216 22 123 456)';
  }

  if (!isPasswordCompliant(password, email)) {
    errors.password = PASSWORD_RULES_MESSAGE;
  }

  if (body.acceptTerms !== true) {
    errors.acceptTerms =
      "Vous devez accepter les conditions d'utilisation et la politique de confidentialité";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    values: { firstName, lastName, email, phone, password },
  };
}

// ---------------------------------------------------------------------------
// Demande de compte praticien : validée ensuite par un administrateur.
// ---------------------------------------------------------------------------

// Liste des spécialités proposées dans le formulaire (à compléter par l'équipe).
export const PRACTITIONER_SPECIALTIES = ['Cardiologie', 'Pédiatrie', 'Médecine générale'];

// N° d'inscription à l'Ordre : format exact à confirmer ; ici 3 à 30 caractères
// (lettres, chiffres, espace, point, tiret, barre oblique).
const ORDER_NUMBER_REGEX = /^[A-Za-z0-9][A-Za-z0-9 ./-]{2,29}$/;

export function validatePractitionerRequest(body = {}) {
  const errors = {};

  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = normalizePhone(body.phone);
  const specialty = typeof body.specialty === 'string' ? body.specialty.trim() : '';
  const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim() : '';
  const cliniqueId = Number(body.cliniqueId);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!NAME_REGEX.test(firstName)) errors.firstName = 'Prénom invalide';
  if (!NAME_REGEX.test(lastName)) errors.lastName = 'Nom invalide';

  if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) {
    errors.email = 'Adresse email invalide';
  }
  if (!phone) {
    errors.phone = 'Numéro de téléphone tunisien invalide (ex. +216 22 123 456)';
  }
  if (!isPasswordCompliant(password, email)) {
    errors.password = PASSWORD_RULES_MESSAGE;
  }
  if (!PRACTITIONER_SPECIALTIES.includes(specialty)) {
    errors.specialty = 'Veuillez choisir une spécialité';
  }
  if (!Number.isInteger(cliniqueId) || cliniqueId <= 0) {
    errors.cliniqueId = 'Veuillez choisir une clinique';
  }
  if (!ORDER_NUMBER_REGEX.test(orderNumber)) {
    errors.orderNumber = "Numéro d'inscription à l'Ordre invalide";
  }
  if (body.acceptTerms !== true) {
    errors.acceptTerms =
      "Vous devez accepter les conditions d'utilisation et la politique de confidentialité";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    values: { firstName, lastName, email, phone, password, specialty, cliniqueId, orderNumber },
  };
}
