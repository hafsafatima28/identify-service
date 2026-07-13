const prisma = require('../db/prismaClient');

/**
 * Custom error type so the controller can distinguish "bad request" from
 * "something broke" without string-matching messages.
 */
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

/**
 * Fetch the full cluster (primary + all its secondaries) for a given primary id.
 */
async function fetchCluster(primaryId) {
  const primary = await prisma.contact.findUnique({ where: { id: primaryId } });
  const secondaries = await prisma.contact.findMany({
    where: { linkedId: primaryId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  return { primary, secondaries };
}

/**
 * Given a set of contacts that matched the incoming email/phone, resolve
 * each one to the id of its "root" primary contact.
 * Contacts are supposed to point directly at their primary via linkedId,
 * but we walk the chain defensively in case of any inconsistent legacy data.
 */
async function resolveToPrimaryId(contact) {
  let current = contact;
  const seen = new Set();
  while (current.linkPrecedence === 'secondary' && current.linkedId && !seen.has(current.id)) {
    seen.add(current.id);
    const next = await prisma.contact.findUnique({ where: { id: current.linkedId } });
    if (!next) break;
    current = next;
  }
  return current.id;
}

/**
 * If the matched contacts trace back to more than one primary, the
 * incoming request has just proven those two "identities" are the same
 * person. Merge them: the OLDER primary wins, the newer one (and anyone
 * already linked to it) gets demoted to secondary under the older one.
 */
async function mergePrimariesIfNeeded(primaryIds) {
  if (primaryIds.length <= 1) return primaryIds[0];

  const primaries = await prisma.contact.findMany({
    where: { id: { in: primaryIds } },
    orderBy: { createdAt: 'asc' },
  });

  const survivor = primaries[0]; // oldest
  const toDemote = primaries.slice(1); // everyone else

  await prisma.$transaction(async (tx) => {
    for (const demoted of toDemote) {
      // Re-point anyone who was secondary under the demoted primary.
      await tx.contact.updateMany({
        where: { linkedId: demoted.id },
        data: { linkedId: survivor.id, updatedAt: new Date() },
      });
      // Demote the primary itself to secondary under the survivor.
      await tx.contact.update({
        where: { id: demoted.id },
        data: {
          linkPrecedence: 'secondary',
          linkedId: survivor.id,
          updatedAt: new Date(),
        },
      });
    }
  });

  return survivor.id;
}

function buildResponsePayload(primary, secondaries) {
  const emails = [];
  const phoneNumbers = [];

  // Primary's own contact info comes first, per the expected response shape.
  if (primary.email) emails.push(primary.email);
  if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);

  for (const s of secondaries) {
    if (s.email && !emails.includes(s.email)) emails.push(s.email);
    if (s.phoneNumber && !phoneNumbers.includes(s.phoneNumber)) phoneNumbers.push(s.phoneNumber);
  }

  return {
    contact: {
      primaryContactId: primary.id,
      emails,
      phoneNumbers,
      secondaryContactIds: secondaries.map((s) => s.id),
    },
  };
}

/**
 * Core entry point used by the /identify controller.
 */
async function identify({ email, phoneNumber }) {
  if (!email && !phoneNumber) {
    throw new ValidationError('At least one of "email" or "phoneNumber" is required.');
  }

  // Normalize: treat empty strings as absent.
  const normalizedEmail = email ? String(email).trim() : null;
  const normalizedPhone = phoneNumber ? String(phoneNumber).trim() : null;

  if (normalizedEmail === '' && normalizedPhone === '') {
    throw new ValidationError('At least one of "email" or "phoneNumber" must be non-empty.');
  }

  const orConditions = [];
  if (normalizedEmail) orConditions.push({ email: normalizedEmail });
  if (normalizedPhone) orConditions.push({ phoneNumber: normalizedPhone });

  const matches = await prisma.contact.findMany({
    where: { deletedAt: null, OR: orConditions },
  });

  // Case 1: nobody matches — this is a brand new identity.
  if (matches.length === 0) {
    const created = await prisma.contact.create({
      data: {
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        linkPrecedence: 'primary',
      },
    });
    return buildResponsePayload(created, []);
  }

  // Case 2/3: something matched. Resolve every match to its root primary.
  const primaryIdsResolved = await Promise.all(matches.map(resolveToPrimaryId));
  const uniquePrimaryIds = [...new Set(primaryIdsResolved)];

  const primaryId = await mergePrimariesIfNeeded(uniquePrimaryIds);
  let { primary, secondaries } = await fetchCluster(primaryId);

  const knownEmails = new Set([primary.email, ...secondaries.map((s) => s.email)].filter(Boolean));
  const knownPhones = new Set(
    [primary.phoneNumber, ...secondaries.map((s) => s.phoneNumber)].filter(Boolean)
  );

  const bringsNewEmail = normalizedEmail && !knownEmails.has(normalizedEmail);
  const bringsNewPhone = normalizedPhone && !knownPhones.has(normalizedPhone);

  if (bringsNewEmail || bringsNewPhone) {
    await prisma.contact.create({
      data: {
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        linkPrecedence: 'secondary',
        linkedId: primary.id,
      },
    });
    ({ primary, secondaries } = await fetchCluster(primaryId));
  }

  return buildResponsePayload(primary, secondaries);
}

module.exports = { identify, ValidationError };
