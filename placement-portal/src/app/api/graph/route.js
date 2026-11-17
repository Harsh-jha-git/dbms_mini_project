import { cypher } from '@/lib/neo4j';
import { getUser } from '@/lib/session';

export async function GET(request) {
  const user = getUser();
  if (!user || user.role !== 'student' || !user.student_id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const studentId = Math.trunc(Number(user.student_id));
  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view');

  if (view === 'recommend') {
    // Collaborative filtering:
    // Find peers who applied to the same opportunities as me,
    // return up to 5 open opportunities I haven't applied to,
    // ranked by number of distinct shared peers.
    const records = await cypher(
      `
      MATCH (me:Student {id: $studentId})-[:APPLIED]->(common:Opportunity)<-[:APPLIED]-(peer:Student)
      WHERE peer <> me
      MATCH (peer)-[:APPLIED]->(rec:Opportunity)
      WHERE rec.open = true AND NOT (me)-[:APPLIED]->(rec)
      RETURN rec.id AS id,
             rec.title AS title,
             rec.company AS company,
             rec.type AS type,
             rec.tier AS tier,
             count(DISTINCT peer) AS shared_peers
      ORDER BY shared_peers DESC, id ASC
      LIMIT 5
      `,
      { studentId }
    );

    const items = records.map((r) => ({
      id: Number(r.get('id')),
      title: r.get('title'),
      company: r.get('company'),
      type: r.get('type'),
      tier: r.get('tier'),
      shared_peers: Number(r.get('shared_peers')),
    }));

    return Response.json(items);
  }

  if (view === 'saved') {
    // List my SAVED opportunities with note
    const records = await cypher(
      `
      MATCH (me:Student {id: $studentId})-[r:SAVED]->(o:Opportunity)
      RETURN o.id AS id,
             o.title AS title,
             o.company AS company,
             o.type AS type,
             o.tier AS tier,
             o.open AS open,
             r.note AS note,
             toString(r.at) AS at
      ORDER BY r.at DESC, id ASC
      `,
      { studentId }
    );

    const items = records.map((r) => ({
      id: Number(r.get('id')),
      title: r.get('title'),
      company: r.get('company'),
      type: r.get('type'),
      tier: r.get('tier'),
      open: Boolean(r.get('open')),
      note: r.get('note') ?? '',
      at: r.get('at'),
    }));

    return Response.json(items);
  }

  return Response.json({ error: 'Invalid view parameter' }, { status: 400 });
}

export async function POST(request) {
  const user = getUser();
  if (!user || user.role !== 'student' || !user.student_id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const studentId = Math.trunc(Number(user.student_id));
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body?.opportunityId === undefined || body?.opportunityId === null) {
    return Response.json({ error: 'opportunityId is required' }, { status: 400 });
  }

  const opportunityId = Math.trunc(Number(body.opportunityId));
  if (isNaN(opportunityId)) {
    return Response.json({ error: 'Invalid opportunityId' }, { status: 400 });
  }

  const res = await cypher(
    `
    MATCH (s:Student {id: $studentId})
    MATCH (o:Opportunity {id: $opportunityId})
    MERGE (s)-[r:SAVED]->(o)
    ON CREATE SET r.note = '', r.at = datetime()
    RETURN r
    `,
    { studentId, opportunityId }
  );

  if (res.length === 0) {
    return Response.json({ error: 'Student or Opportunity not found' }, { status: 404 });
  }

  return Response.json({ ok: true, saved: true });
}

export async function PATCH(request) {
  const user = getUser();
  if (!user || user.role !== 'student' || !user.student_id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const studentId = Math.trunc(Number(user.student_id));
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body?.opportunityId === undefined || body?.opportunityId === null) {
    return Response.json({ error: 'opportunityId is required' }, { status: 400 });
  }

  const opportunityId = Math.trunc(Number(body.opportunityId));
  if (isNaN(opportunityId)) {
    return Response.json({ error: 'Invalid opportunityId' }, { status: 400 });
  }

  const note = String(body.note ?? '').slice(0, 200);

  const res = await cypher(
    `
    MATCH (s:Student {id: $studentId})-[r:SAVED]->(o:Opportunity {id: $opportunityId})
    SET r.note = $note
    RETURN r.note AS note
    `,
    { studentId, opportunityId, note }
  );

  if (res.length === 0) {
    return Response.json({ error: 'Saved relationship not found' }, { status: 404 });
  }

  return Response.json({ ok: true, note });
}

export async function DELETE(request) {
  const user = getUser();
  if (!user || user.role !== 'student' || !user.student_id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const studentId = Math.trunc(Number(user.student_id));
  const { searchParams } = new URL(request.url);
  const oppParam = searchParams.get('opportunityId');

  if (!oppParam) {
    return Response.json({ error: 'opportunityId is required' }, { status: 400 });
  }

  const opportunityId = Math.trunc(Number(oppParam));
  if (isNaN(opportunityId)) {
    return Response.json({ error: 'Invalid opportunityId' }, { status: 400 });
  }

  await cypher(
    `
    MATCH (s:Student {id: $studentId})-[r:SAVED]->(o:Opportunity {id: $opportunityId})
    DELETE r
    `,
    { studentId, opportunityId }
  );

  return Response.json({ ok: true, deleted: true });
}
