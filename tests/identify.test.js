const { createFakePrismaClient } = require('./fakePrismaClient');

const fakePrisma = createFakePrismaClient();

// Redirect the service's DB import to our in-memory fake before it's required.
jest.mock('../src/db/prismaClient', () => {
  const { createFakePrismaClient } = require('./fakePrismaClient');
  return global.__fakePrismaSingleton || (global.__fakePrismaSingleton = createFakePrismaClient());
});

const { identify, ValidationError } = require('../src/services/identifyService');

beforeEach(() => {
  global.__fakePrismaSingleton.__reset();
});

describe('identify()', () => {
  test('throws ValidationError when both email and phoneNumber are missing', async () => {
    await expect(identify({})).rejects.toBeInstanceOf(ValidationError);
  });

  test('creates a new primary contact when nothing matches', async () => {
    const result = await identify({ email: 'doc@time.com', phoneNumber: '123456' });

    expect(result.contact.primaryContactId).toBeDefined();
    expect(result.contact.emails).toEqual(['doc@time.com']);
    expect(result.contact.phoneNumbers).toEqual(['123456']);
    expect(result.contact.secondaryContactIds).toEqual([]);
  });

  test('creates a secondary contact when request shares one field but adds new info', async () => {
    const first = await identify({ email: 'doc@time.com', phoneNumber: '123456' });
    const primaryId = first.contact.primaryContactId;

    const second = await identify({ email: 'doc.alt@time.com', phoneNumber: '123456' });

    expect(second.contact.primaryContactId).toBe(primaryId);
    expect(second.contact.emails).toEqual(['doc@time.com', 'doc.alt@time.com']);
    expect(second.contact.phoneNumbers).toEqual(['123456']);
    expect(second.contact.secondaryContactIds).toHaveLength(1);
  });

  test('does not duplicate a secondary when the exact same email+phone is sent again', async () => {
    await identify({ email: 'doc@time.com', phoneNumber: '123456' });
    await identify({ email: 'doc.alt@time.com', phoneNumber: '123456' });
    const third = await identify({ email: 'doc@time.com', phoneNumber: '123456' });

    expect(third.contact.secondaryContactIds).toHaveLength(1);
  });

  test('merges two separate primaries when a request links them, older one wins', async () => {
    const a = await identify({ email: 'doc@time.com', phoneNumber: '111111' });
    // small delay so createdAt ordering is unambiguous in the fake client
    const b = await identify({ email: 'shekar@time.com', phoneNumber: '222222' });

    expect(a.contact.primaryContactId).not.toBe(b.contact.primaryContactId);

    // This request ties the two identities together.
    const merged = await identify({ email: 'doc@time.com', phoneNumber: '222222' });

    expect(merged.contact.primaryContactId).toBe(a.contact.primaryContactId);
    expect(merged.contact.emails).toEqual(
      expect.arrayContaining(['doc@time.com', 'shekar@time.com'])
    );
    expect(merged.contact.phoneNumbers).toEqual(
      expect.arrayContaining(['111111', '222222'])
    );
    // b's original primary should now show up as a secondary id
    expect(merged.contact.secondaryContactIds).toContain(b.contact.primaryContactId);
  });

  test('handles a request with only an email (no phoneNumber)', async () => {
    const result = await identify({ email: 'onlyemail@time.com' });
    expect(result.contact.emails).toEqual(['onlyemail@time.com']);
    expect(result.contact.phoneNumbers).toEqual([]);
  });

  test('handles a request with only a phoneNumber (no email)', async () => {
    const result = await identify({ phoneNumber: '999999' });
    expect(result.contact.phoneNumbers).toEqual(['999999']);
    expect(result.contact.emails).toEqual([]);
  });
});
