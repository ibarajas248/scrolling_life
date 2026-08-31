import http from 'node:http';
import { copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SEED_PATH = process.env.GRAPH_SEED_PATH || path.join(DATA_DIR, 'grafo-3d.seed.json');
const DATA_PATH = process.env.GRAPH_DATA_PATH || path.join(DATA_DIR, 'grafo-3d.local.json');
const PORT = Number(process.env.GRAPH_PORT || readArg('--port') || 8091);
const HOST = process.env.GRAPH_HOST || readArg('--host') || '127.0.0.1';
const MAX_TEXT_LENGTH = 260;
const STORAGE_DRIVER = (process.env.GRAPH_DB_DRIVER || (process.env.MYSQL_HOST ? 'mysql' : 'json')).toLowerCase();
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE || 'scrollinglife_graph',
  user: process.env.MYSQL_USER || 'scrollinglife_graph',
  password: process.env.MYSQL_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 8),
  charset: 'utf8mb4',
  timezone: 'Z'
};

let mysqlPool = null;

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true });
  if (await exists(DATA_PATH)) return;
  if (await exists(SEED_PATH)) {
    await copyFile(SEED_PATH, DATA_PATH);
    return;
  }
  await writeJsonGraph({
    version: 1,
    updatedAt: new Date().toISOString(),
    nodes: [{ id: 'n_scroll', text: 'El scroll no avanza: nos absorbe.', createdAt: new Date().toISOString() }],
    edges: []
  });
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function normalizeGraph(rawGraph) {
  const safeNodes = Array.isArray(rawGraph?.nodes)
    ? rawGraph.nodes
        .filter((node) => node && typeof node.id === 'string' && typeof node.text === 'string')
        .map((node) => ({
          id: node.id,
          text: normalizeText(node.text),
          parentId: typeof node.parentId === 'string' ? node.parentId : undefined,
          createdAt: node.createdAt || new Date().toISOString()
        }))
    : [];
  const ids = new Set(safeNodes.map((node) => node.id));
  const safeEdges = Array.isArray(rawGraph?.edges)
    ? rawGraph.edges
        .filter((edge) => edge && ids.has(edge.source) && ids.has(edge.target))
        .map((edge) => ({
          source: edge.source,
          target: edge.target,
          relation: normalizeText(edge.relation || 'relacion') || 'relacion'
        }))
    : [];

  return {
    version: Number(rawGraph?.version) || 1,
    updatedAt: rawGraph?.updatedAt || new Date().toISOString(),
    nodes: safeNodes,
    edges: safeEdges
  };
}

async function readSeedGraph() {
  try {
    const raw = await readFile(SEED_PATH, 'utf8');
    return normalizeGraph(JSON.parse(raw));
  } catch {
    return normalizeGraph({
      version: 1,
      updatedAt: new Date().toISOString(),
      nodes: [{ id: 'n_scroll', text: 'El scroll no avanza: nos absorbe.', createdAt: new Date().toISOString() }],
      edges: []
    });
  }
}

async function readJsonGraph() {
  await ensureDataFile();
  const raw = await readFile(DATA_PATH, 'utf8');
  return normalizeGraph(JSON.parse(raw));
}

async function writeJsonGraph(graph) {
  const nextGraph = normalizeGraph({
    ...graph,
    updatedAt: new Date().toISOString()
  });
  const tempPath = `${DATA_PATH}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(nextGraph, null, 2)}\n`, 'utf8');
  await rename(tempPath, DATA_PATH);
  return nextGraph;
}

async function getMysqlPool() {
  if (mysqlPool) return mysqlPool;
  const mysql = await import('mysql2/promise');
  mysqlPool = mysql.createPool(MYSQL_CONFIG);
  return mysqlPool;
}

const mysqlDate = (value) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const mysqlIso = (value) => {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

async function ensureMysqlSchema() {
  const pool = await getMysqlPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS graph_nodes (
      id VARCHAR(96) NOT NULL PRIMARY KEY,
      text VARCHAR(260) NOT NULL,
      parent_id VARCHAR(96) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_parent_id (parent_id),
      INDEX idx_created_at (created_at)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS graph_edges (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      source VARCHAR(96) NOT NULL,
      target VARCHAR(96) NOT NULL,
      relation VARCHAR(64) NOT NULL DEFAULT 'relacion',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uniq_graph_edge (source, target, relation),
      INDEX idx_source (source),
      INDEX idx_target (target)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  const seed = await readSeedGraph();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const node of seed.nodes) {
      await connection.execute(
        'INSERT IGNORE INTO graph_nodes (id, text, parent_id, created_at) VALUES (?, ?, ?, ?)',
        [node.id, node.text, node.parentId || null, mysqlDate(node.createdAt)]
      );
    }
    for (const edge of seed.edges) {
      await connection.execute(
        'INSERT IGNORE INTO graph_edges (source, target, relation, created_at) VALUES (?, ?, ?, ?)',
        [edge.source, edge.target, edge.relation || 'relacion', mysqlDate(seed.updatedAt)]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function readMysqlGraph() {
  const pool = await getMysqlPool();
  const [nodes] = await pool.query(`
    SELECT id, text, parent_id AS parentId, created_at AS createdAt
    FROM graph_nodes
    ORDER BY created_at ASC, id ASC
  `);
  const [edges] = await pool.query(`
    SELECT source, target, relation
    FROM graph_edges
    ORDER BY id ASC
  `);

  return normalizeGraph({
    version: 1,
    updatedAt: new Date().toISOString(),
    nodes: nodes.map((node) => ({
      id: node.id,
      text: node.text,
      parentId: node.parentId || undefined,
      createdAt: mysqlIso(node.createdAt)
    })),
    edges
  });
}

async function createMysqlNode(parentId, text) {
  const pool = await getMysqlPool();
  const node = {
    id: `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    parentId,
    createdAt: new Date().toISOString()
  };
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [[parent]] = await connection.execute('SELECT id FROM graph_nodes WHERE id = ? LIMIT 1', [parentId]);
    if (!parent) {
      await connection.rollback();
      return { error: 'parent node not found' };
    }
    await connection.execute(
      'INSERT INTO graph_nodes (id, text, parent_id, created_at) VALUES (?, ?, ?, ?)',
      [node.id, node.text, node.parentId, mysqlDate(node.createdAt)]
    );
    await connection.execute(
      'INSERT INTO graph_edges (source, target, relation, created_at) VALUES (?, ?, ?, ?)',
      [parentId, node.id, 'respuesta', mysqlDate(node.createdAt)]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return { node, graph: await readMysqlGraph() };
}

async function ensureStorage() {
  if (STORAGE_DRIVER === 'mysql') {
    await ensureMysqlSchema();
    return;
  }
  await ensureDataFile();
}

async function readGraph() {
  if (STORAGE_DRIVER === 'mysql') {
    return readMysqlGraph();
  }
  return readJsonGraph();
}

async function writeGraph(graph) {
  if (STORAGE_DRIVER === 'mysql') {
    throw new Error('writeGraph is not available for mysql storage');
  }
  return writeJsonGraph(graph);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Accept'
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 16_384) {
        request.destroy();
        reject(new Error('body too large'));
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

async function handleCreateNode(request, response) {
  const body = await readBody(request);
  const payload = body ? JSON.parse(body) : {};
  const parentId = normalizeText(payload.parentId);
  const text = normalizeText(payload.text);
  const graph = await readGraph();
  const parent = graph.nodes.find((node) => node.id === parentId);

  if (!parent) {
    sendJson(response, 400, { error: 'parent node not found' });
    return;
  }

  if (!text) {
    sendJson(response, 400, { error: 'text is required' });
    return;
  }

  if (STORAGE_DRIVER === 'mysql') {
    const result = await createMysqlNode(parentId, text);
    if (result.error) {
      sendJson(response, 400, { error: result.error });
      return;
    }
    sendJson(response, 201, result);
    return;
  }

  const node = {
    id: `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    parentId,
    createdAt: new Date().toISOString()
  };
  const nextGraph = await writeGraph({
    ...graph,
    nodes: [...graph.nodes, node],
    edges: [...graph.edges, { source: parentId, target: node.id, relation: 'respuesta' }]
  });

  sendJson(response, 201, { node, graph: nextGraph });
}

const server = http.createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || `localhost:${PORT}`}`);

  try {
    if (request.method === 'GET' && url.pathname === '/api/graph') {
      sendJson(response, 200, await readGraph());
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/graph/nodes') {
      await handleCreateNode(request, response);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { ok: true, storage: STORAGE_DRIVER });
      return;
    }

    sendJson(response, 404, { error: 'not found' });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: 'internal error' });
  }
});

await ensureStorage();

server.listen(PORT, HOST, () => {
  console.log(`Grafo 3D backend listo en http://${HOST}:${PORT}`);
  console.log(`Guardando nodos en ${STORAGE_DRIVER === 'mysql' ? `${MYSQL_CONFIG.host}/${MYSQL_CONFIG.database}` : DATA_PATH}`);
});
