const BASE_URL = process.env.API_BASE_URL || "http://localhost:5000/api";
const TEST_EMAIL = process.env.TEST_API_USER_EMAIL || "admin@wezesha.org";
const TEST_PASSWORD = process.env.TEST_API_USER_PASSWORD || "admin@1234";

const ENDPOINTS = [
  { name: "Dashboard", path: "/dashboard", type: "object" },
  { name: "Partners", path: "/partners", type: "array" },
  { name: "Cohorts", path: "/cohorts", type: "array" },
  { name: "Personnel", path: "/personnel", type: "array" },
  { name: "Youth", path: "/youth", type: "array" },
  { name: "Youth at-risk", path: "/youth/at-risk", type: "object" },
  { name: "Sessions low attendance", path: "/sessions/low-attendance", type: "object" },
  { name: "Attendance", path: "/attendance", type: "array" },
  { name: "Cases", path: "/cases", type: "array" },
  { name: "Outcomes", path: "/outcomes", type: "array" },
  { name: "Reports", path: "/reports", type: "array" },
  { name: "Users", path: "/users", type: "object" },
];

async function request(path, options = {}, expectJson = true) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);

  if (!expectJson) {
    return { status: res.status, headers: res.headers };
  }

  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function matchesType(body, type) {
  if (type === "array") return Array.isArray(body);
  if (type === "object") return body && typeof body === "object" && !Array.isArray(body);
  return true;
}

async function testHealth() {
  try {
    const res = await request("/health");
    return {
      name: "Health check",
      status: res.status,
      passed: res.status === 200 && res.body?.status === "Backend is running",
    };
  } catch (err) {
    return { name: "Health check", status: null, passed: false, error: err.message };
  }
}

async function testLogin() {
  try {
    const res = await request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });

    const passed = res.status === 200 && Boolean(res.body?.token);
    return {
      name: "Auth login",
      status: res.status,
      passed,
      token: passed ? res.body.token : null,
      user: passed ? res.body.user : null,
    };
  } catch (err) {
    return { name: "Auth login", status: null, passed: false, token: null, error: err.message };
  }
}

async function testAuthMe(token) {
  try {
    const res = await request("/auth/me", { headers: authHeaders(token) });
    return {
      name: "Auth me",
      status: res.status,
      passed: res.status === 200 && res.body?.email === TEST_EMAIL,
    };
  } catch (err) {
    return { name: "Auth me", status: null, passed: false, error: err.message };
  }
}

async function testEndpoint(token, endpoint) {
  try {
    const res = await request(endpoint.path, { headers: authHeaders(token) });
    const passed = res.status === 200 && matchesType(res.body, endpoint.type);
    return { name: endpoint.name, status: res.status, passed };
  } catch (err) {
    return { name: endpoint.name, status: null, passed: false, error: err.message };
  }
}

async function testExport(token) {
  try {
    const res = await request(
      "/export?resource=users",
      { headers: authHeaders(token) },
      false
    );
    const contentType = res.headers?.get("content-type") || "";
    const passed =
      res.status === 200 &&
      contentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return { name: "Export users", status: res.status, passed, contentType };
  } catch (err) {
    return { name: "Export users", status: null, passed: false, error: err.message };
  }
}

async function run() {
  const results = [];

  results.push(await testHealth());

  const login = await testLogin();
  results.push(login);

  if (login.token) {
    results.push(await testAuthMe(login.token));

    for (const endpoint of ENDPOINTS) {
      results.push(await testEndpoint(login.token, endpoint));
    }

    results.push(await testExport(login.token));
  }

  const passedCount = results.filter((r) => r.passed).length;

  return {
    total: results.length,
    passed: passedCount,
    failed: results.length - passedCount,
    results,
  };
}

function printResults(summary) {
  for (const r of summary.results) {
    const icon = r.passed ? "✅" : "❌";
    const status = r.status ?? "N/A";
    const detail = r.error ? ` - ${r.error}` : "";
    console.log(`${icon} ${r.name} [${status}]${detail}`);
  }

  console.log(`\nTest summary: ${summary.passed}/${summary.total} passed`);

  if (summary.failed > 0) {
    console.log("Failed tests:");
    summary.results
      .filter((r) => !r.passed)
      .forEach((r) => console.log(`- ${r.name} [${r.status ?? "N/A"}]${r.error ? `: ${r.error}` : ""}`));
  }
}

module.exports = { run, printResults };

if (require.main === module) {
  run().then((summary) => {
    printResults(summary);
    process.exitCode = summary.failed > 0 ? 1 : 0;
  });
}