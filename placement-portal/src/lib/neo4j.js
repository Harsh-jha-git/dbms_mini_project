import neo4j from 'neo4j-driver';

const g = globalThis;

export const driver =
  g._neo4jDriver ??
  (g._neo4jDriver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  ));

export async function cypher(query, params = {}) {
  const session = driver.session();
  try {
    const res = await session.run(query, params);
    return res.records;
  } finally {
    await session.close();
  }
}
