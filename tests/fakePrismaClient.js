/**
 * A tiny in-memory stand-in for PrismaClient's `contact` model, just
 * enough surface area for identifyService's tests to run without a real
 * PostgreSQL instance. Keeps the unit tests fast and hermetic (the
 * "covert unit testing" bonus — no live DB needed to validate logic).
 */
function createFakePrismaClient() {
  let rows = [];
  let nextId = 1;

  function matchesOr(row, orConditions) {
    return orConditions.some((cond) => {
      if ('email' in cond) return row.email === cond.email;
      if ('phoneNumber' in cond) return row.phoneNumber === cond.phoneNumber;
      return false;
    });
  }

  function matchesWhere(row, where = {}) {
    if (where.deletedAt === null && row.deletedAt !== null) return false;
    if (where.id !== undefined) {
      if (typeof where.id === 'object' && where.id.in) {
        if (!where.id.in.includes(row.id)) return false;
      } else if (row.id !== where.id) {
        return false;
      }
    }
    if (where.linkedId !== undefined && row.linkedId !== where.linkedId) return false;
    if (where.OR && !matchesOr(row, where.OR)) return false;
    return true;
  }

  const contact = {
    async findMany({ where = {}, orderBy } = {}) {
      let result = rows.filter((r) => matchesWhere(r, where));
      if (orderBy && orderBy.createdAt === 'asc') {
        result = [...result].sort((a, b) => a.createdAt - b.createdAt);
      }
      return result.map((r) => ({ ...r }));
    },
    async findUnique({ where }) {
      const found = rows.find((r) => r.id === where.id);
      return found ? { ...found } : null;
    },
    async create({ data }) {
      const row = {
        id: nextId++,
        email: data.email ?? null,
        phoneNumber: data.phoneNumber ?? null,
        linkedId: data.linkedId ?? null,
        linkPrecedence: data.linkPrecedence ?? 'primary',
        createdAt: new Date(Date.now() + nextId), // monotonically increasing for ordering
        updatedAt: new Date(),
        deletedAt: null,
      };
      rows.push(row);
      return { ...row };
    },
    async update({ where, data }) {
      const row = rows.find((r) => r.id === where.id);
      if (!row) return null;
      Object.assign(row, data);
      return { ...row };
    },
    async updateMany({ where, data }) {
      const matched = rows.filter((r) => matchesWhere(r, where));
      matched.forEach((r) => Object.assign(r, data));
      return { count: matched.length };
    },
  };

  return {
    contact,
    async $transaction(fn) {
      // Fake client is synchronous/in-memory, so just run the callback.
      return fn({ contact });
    },
    __reset() {
      rows = [];
      nextId = 1;
    },
    __dump() {
      return rows.map((r) => ({ ...r }));
    },
  };
}

module.exports = { createFakePrismaClient };
