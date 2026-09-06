import path from "node:path";
const FRAMEWORK_PACKAGES = {
    next: "Next.js",
    react: "React",
    express: "Express",
    "@nestjs/core": "NestJS",
    fastapi: "FastAPI",
    django: "Django",
    flask: "Flask",
};
const AUTH_PACKAGES = new Set([
    "next-auth",
    "@auth/core",
    "passport",
    "passport-jwt",
    "express-session",
    "jsonwebtoken",
    "jose",
    "oauth4webapi",
    "openid-client",
    "bcrypt",
    "argon2",
    "pyjwt",
    "python-jose",
    "django-allauth",
    "flask-login",
]);
const ORM_PACKAGES = {
    prisma: "Prisma",
    "@prisma/client": "Prisma",
    sequelize: "Sequelize",
    typeorm: "TypeORM",
    mongoose: "MongoDB/Mongoose",
    sqlalchemy: "SQLAlchemy",
    psycopg: "PostgreSQL/psycopg",
    "django-orm": "Django ORM",
};
function safePackageJson(file) {
    if (path.basename(file.relativePath).toLowerCase() !== "package.json")
        return undefined;
    try {
        const value = JSON.parse(file.text);
        return typeof value === "object" && value !== null ? value : undefined;
    }
    catch {
        return undefined;
    }
}
function addDependencies(target, packageJson) {
    for (const collection of [packageJson.dependencies, packageJson.devDependencies]) {
        if (collection === undefined)
            continue;
        for (const dependency of Object.keys(collection))
            target.add(dependency.toLowerCase());
    }
}
function detectPythonPackages(files) {
    const packages = new Set();
    for (const file of files) {
        const name = path.basename(file.relativePath).toLowerCase();
        if (!["requirements.txt", "pyproject.toml", "pipfile", "poetry.lock"].includes(name))
            continue;
        const lower = file.text.toLowerCase();
        for (const dependency of [
            "fastapi",
            "django",
            "flask",
            "pyjwt",
            "python-jose",
            "sqlalchemy",
            "psycopg",
            "argon2",
            "bcrypt",
        ]) {
            if (new RegExp(`(^|[^a-z0-9_-])${dependency.replace("-", "[-_]?")}([^a-z0-9_-]|$)`, "m").test(lower)) {
                packages.add(dependency);
            }
        }
    }
    return packages;
}
function sorted(values) {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
function addLiteralRoutes(target, file) {
    if (!["javascript", "typescript", "python"].includes(file.language))
        return;
    const routePattern = /(?:\b(?:app|router)\.(get|post|put|patch|delete)|@(?:app|router)\.(get|post|put|patch|delete))\s*\(\s*["']([^"']+)["']/gi;
    for (const match of file.text.matchAll(routePattern)) {
        const method = (match.at(1) ?? match.at(2))?.toUpperCase();
        const route = match.at(3);
        if (method !== undefined && route !== undefined) {
            target.add(`${file.relativePath}#${method} ${route}`);
        }
    }
}
export function buildRepositoryManifest(traversal) {
    const { files } = traversal;
    const dependencyNames = new Set();
    const packageFiles = [];
    for (const file of files) {
        const parsed = safePackageJson(file);
        if (parsed !== undefined) {
            packageFiles.push({ file, parsed });
            addDependencies(dependencyNames, parsed);
        }
    }
    for (const dependency of detectPythonPackages(files))
        dependencyNames.add(dependency);
    const languages = new Set();
    for (const file of files) {
        if (file.language !== "other" && file.language !== "configuration")
            languages.add(file.language);
    }
    const frameworks = new Set();
    for (const [dependency, framework] of Object.entries(FRAMEWORK_PACKAGES)) {
        if (dependencyNames.has(dependency))
            frameworks.add(framework);
    }
    const packageManagers = new Set();
    const lockfiles = new Set();
    const infrastructure = new Set();
    const ci = new Set();
    const monorepoBoundaries = new Set();
    const testFrameworks = new Set();
    const entrypoints = new Set();
    const apiRoutes = new Set();
    for (const file of files) {
        const lower = file.relativePath.toLowerCase();
        const name = path.basename(lower);
        if (name === "package-lock.json") {
            packageManagers.add("npm");
            lockfiles.add(file.relativePath);
        }
        else if (name === "pnpm-lock.yaml") {
            packageManagers.add("pnpm");
            lockfiles.add(file.relativePath);
        }
        else if (name === "yarn.lock") {
            packageManagers.add("Yarn");
            lockfiles.add(file.relativePath);
        }
        else if (name === "poetry.lock") {
            packageManagers.add("Poetry");
            lockfiles.add(file.relativePath);
        }
        else if (name === "pipfile.lock") {
            packageManagers.add("Pipenv");
            lockfiles.add(file.relativePath);
        }
        else if (name === "uv.lock") {
            packageManagers.add("uv");
            lockfiles.add(file.relativePath);
        }
        if (name === "requirements.txt" || name === "pyproject.toml")
            packageManagers.add("pip/PEP 517");
        if (["dockerfile", "containerfile", "docker-compose.yml", "docker-compose.yaml"].includes(name)) {
            infrastructure.add("Docker");
        }
        if (lower.includes("kubernetes/") || lower.includes("k8s/"))
            infrastructure.add("Kubernetes");
        if (lower.endsWith(".tf"))
            infrastructure.add("Terraform");
        if (lower.includes("nginx") || lower.includes("traefik") || lower.includes("caddy")) {
            infrastructure.add("reverse proxy configuration");
        }
        if (lower.startsWith(".github/workflows/") &&
            (lower.endsWith(".yml") || lower.endsWith(".yaml"))) {
            ci.add("GitHub Actions");
        }
        if ([
            "server.ts",
            "server.js",
            "app.ts",
            "app.js",
            "main.ts",
            "main.js",
            "main.py",
            "app.py",
            "wsgi.py",
            "asgi.py",
            "manage.py",
        ].includes(name) ||
            /(^|\/)pages\/api\/.+\.[jt]sx?$/.test(lower) ||
            /(^|\/)app\/api\/.+\/route\.[jt]s$/.test(lower)) {
            entrypoints.add(file.relativePath);
        }
        if (/routes?|controllers?|pages\/api|app\/api/.test(lower))
            apiRoutes.add(file.relativePath);
        addLiteralRoutes(apiRoutes, file);
        if (/(__tests__|\/tests?\/|\.test\.|\.spec\.)/.test(lower))
            testFrameworks.add("repository tests");
    }
    for (const { file, parsed } of packageFiles) {
        if (parsed.workspaces !== undefined)
            monorepoBoundaries.add(path.posix.dirname(file.relativePath));
    }
    for (const boundaryName of ["pnpm-workspace.yaml", "turbo.json", "nx.json"]) {
        const found = files.find((file) => file.relativePath.toLowerCase() === boundaryName);
        if (found !== undefined)
            monorepoBoundaries.add(".");
    }
    if (dependencyNames.has("vitest"))
        testFrameworks.add("Vitest");
    if (dependencyNames.has("jest"))
        testFrameworks.add("Jest");
    if (dependencyNames.has("pytest"))
        testFrameworks.add("pytest");
    const authenticationLibraries = sorted([...dependencyNames].filter((name) => AUTH_PACKAGES.has(name)));
    const ormAndDatabases = sorted([...dependencyNames]
        .map((name) => ORM_PACKAGES[name])
        .filter((value) => value !== undefined));
    const sessionAndTokenTechnology = sorted([
        ...(dependencyNames.has("express-session") ? ["express-session"] : []),
        ...(dependencyNames.has("jsonwebtoken") || dependencyNames.has("pyjwt") ? ["JWT"] : []),
        ...(dependencyNames.has("jose") || dependencyNames.has("python-jose") ? ["JOSE/JWT"] : []),
        ...(dependencyNames.has("flask-login") ? ["Flask-Login session"] : []),
        ...(dependencyNames.has("django") ? ["Django session"] : []),
    ]);
    const oauthOidcProviders = sorted([
        ...(dependencyNames.has("next-auth") || dependencyNames.has("@auth/core")
            ? ["Auth.js providers"]
            : []),
        ...(dependencyNames.has("passport") ? ["Passport strategies"] : []),
        ...(dependencyNames.has("oauth4webapi") ? ["oauth4webapi"] : []),
        ...(dependencyNames.has("openid-client") ? ["openid-client"] : []),
    ]);
    return {
        ...traversal.baseManifest,
        languages: sorted(languages),
        frameworks: sorted(frameworks),
        packageManagers: sorted(packageManagers),
        lockfiles: sorted(lockfiles),
        applicationEntrypoints: sorted(entrypoints),
        apiRoutes: sorted(apiRoutes),
        authenticationLibraries,
        ormAndDatabases,
        sessionAndTokenTechnology,
        oauthOidcProviders,
        infrastructure: sorted(infrastructure),
        ci: sorted(ci),
        monorepoBoundaries: sorted(monorepoBoundaries),
        testFrameworks: sorted(testFrameworks),
    };
}
//# sourceMappingURL=discover.js.map