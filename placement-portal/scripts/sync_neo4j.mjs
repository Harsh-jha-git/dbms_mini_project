import mysql from 'mysql2/promise';
import neo4j from 'neo4j-driver';

async function sync() {
  console.log('Connecting to MySQL and Neo4j...');

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'internship_recruitment_db',
  });

  const driver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://127.0.0.1:7687',
    neo4j.auth.basic(
      process.env.NEO4J_USER || 'neo4j',
      process.env.NEO4J_PASSWORD || ''
    )
  );

  const session = driver.session();

  try {
    console.log('Creating constraints and clearing existing graph...');
    await session.run('CREATE CONSTRAINT IF NOT EXISTS FOR (s:Student) REQUIRE s.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT IF NOT EXISTS FOR (o:Opportunity) REQUIRE o.id IS UNIQUE');
    await session.run('MATCH (n) DETACH DELETE n');

    console.log('Fetching students from MySQL...');
    const [students] = await pool.query(`
      SELECT 
        s.student_id AS id,
        s.name,
        CAST(s.cgpa AS DOUBLE) AS cgpa,
        b.branch_name AS branch
      FROM student s
      JOIN branch b ON s.branch_id = b.branch_id
    `);

    const studentBatch = students.map((s) => ({
      id: Math.trunc(Number(s.id)),
      name: s.name,
      cgpa: Number(s.cgpa),
      branch: s.branch,
    }));

    await session.run(
      `
      UNWIND $batch AS s
      CREATE (st:Student {
        id: s.id,
        name: s.name,
        cgpa: s.cgpa,
        branch: s.branch
      })
      `,
      { batch: studentBatch }
    );
    console.log(`Synced ${studentBatch.length} students.`);

    console.log('Fetching opportunities from MySQL...');
    const [opportunities] = await pool.query(`
      SELECT 
        o.opportunity_id AS id,
        o.title,
        o.tier,
        o.type,
        c.company_name AS company,
        (o.status = 'Open' AND o.approval_status = 'Approved') AS is_open
      FROM opportunity o
      JOIN company c ON o.company_id = c.company_id
    `);

    const oppBatch = opportunities.map((o) => ({
      id: Math.trunc(Number(o.id)),
      title: o.title,
      tier: o.tier ?? null,
      type: o.type,
      company: o.company,
      open: Boolean(o.is_open),
    }));

    await session.run(
      `
      UNWIND $batch AS o
      CREATE (op:Opportunity {
        id: o.id,
        title: o.title,
        tier: o.tier,
        type: o.type,
        company: o.company,
        open: o.open
      })
      `,
      { batch: oppBatch }
    );
    console.log(`Synced ${oppBatch.length} opportunities.`);

    console.log('Fetching applications from MySQL...');
    const [applications] = await pool.query(`
      SELECT student_id, opportunity_id, status FROM application
    `);

    const appBatch = applications.map((a) => ({
      student_id: Math.trunc(Number(a.student_id)),
      opportunity_id: Math.trunc(Number(a.opportunity_id)),
      status: a.status,
    }));

    await session.run(
      `
      UNWIND $batch AS a
      MATCH (st:Student {id: a.student_id})
      MATCH (op:Opportunity {id: a.opportunity_id})
      CREATE (st)-[:APPLIED {status: a.status}]->(op)
      `,
      { batch: appBatch }
    );
    console.log(`Synced ${appBatch.length} applications.`);

    console.log('Graph sync completed successfully.');
  } finally {
    await session.close();
    await driver.close();
    await pool.end();
  }
}

sync().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
