# Alpha.12 pinned corpus evidence

Thirty immutable repositories expand the eleven-target alpha.11 Batch 2 corpus. Every target
completed two full-report deterministic offline scans. Full findings, UNKNOWN records, engine
completeness, limits and metrics are in validation/alpha12/corpus; source reviews are in
corpus-adjudication.json. Acquisition alone uses Git network access; analysis never installs
dependencies or executes target code.

| Repository                                     | Immutable commit                         | Findings | UNKNOWN instances | Completeness | Scan seconds (pair) |
| ---------------------------------------------- | ---------------------------------------- | -------: | ----------------: | ------------ | ------------------- |
| OWASP/NodeGoat                                 | c5cb68a7084e4ae7dcc60e6a98768720a81841e8 |        7 |                 7 | TRUNCATED    | 4.64 / 3.74         |
| appsecco/dvna                                  | 9ba473add536f66ac9007966acb2a775dd31277a |        1 |                12 | TRUNCATED    | 1.72 / 1.73         |
| expressjs/express                              | 53d4a0d606c0388f764f192b306ce0e90200e7e8 |        0 |                 1 | PARTIAL      | 2.47 / 2.03         |
| fastify/fastify                                | d266f833f2bff34c6115c026e461b682e94d0b9c |        0 |                 0 | TRUNCATED    | 8.81 / 10.12        |
| Vikas2171/vulnerable-website                   | 1258fa3efac1547da5bb3c7e6ab8279f00e47206 |       11 |                 0 | COMPLETE     | 0.28 / 0.14         |
| juice-shop/juice-shop                          | 1618a611b173b4bf114028e6e02549950606e29d |       10 |               143 | TRUNCATED    | 12.56 / 17.63       |
| we45/Vulnerable-Flask-App                      | b6a4f97afd466e83e1f60781494252dec1c37039 |        5 |                 4 | PARTIAL      | 1.67 / 1.23         |
| stephenbradshaw/breakableflask                 | 553e8b2f51c14f259f565d5df478339c366a9172 |        1 |                 4 | PARTIAL      | 0.25 / 0.15         |
| pallets/flask                                  | d73fa1cdcbd8b1465c151db8924ba58b1dd14e35 |        1 |                 4 | PARTIAL      | 1.22 / 0.82         |
| LevaAverGit/appsec-review-lab-v2               | 372ed54ad40059f4228f9e08dc375c51fe60b625 |       10 |                 6 | PARTIAL      | 0.74 / 0.49         |
| vercel/nextjs-postgres-auth-starter            | fde8ecf1da9337223081f70cf88b420060039d6e |        0 |                 0 | COMPLETE     | 0.64 / 0.21         |
| AntonyNRM/vulnerable-flask-app                 | 7a12a015d0fc0d028be5cf492db822bce9af45ba |        3 |                 0 | COMPLETE     | 0.23 / 0.12         |
| axios/axios                                    | 18e7dfedf30c96e58652887f930642ae82e0130c |        1 |                 2 | TRUNCATED    | 7.78 / 6.71         |
| django/django                                  | 2b30f6255b5ef84afbd827993643d52ef2c0963a |       61 |                 0 | TRUNCATED    | 29.23 / 20.64       |
| fastapi/fastapi                                | 50113da16fec53b66b80d75e80a89296de4fa5a5 |        0 |                 0 | TRUNCATED    | 11.68 / 6.82        |
| guilatrova/flask-sqlinjection-vulnerable       | 708246139f2f216c55c683c7aec2297bc91b7346 |        0 |                 0 | COMPLETE     | 0.26 / 0.13         |
| payatu/vuln-nodejs-app                         | bc3c90920ba4e1c668d954e5027d9ca814d2d5c6 |        0 |                 4 | TRUNCATED    | 2.91 / 2.03         |
| vulnerable-apps/simple-ssrf                    | 9fe0f47ca9bc69faf8454e96e0dcdf1400ce8a5a |        1 |                 0 | COMPLETE     | 0.17 / 0.09         |
| SirAppSec/vuln-node.js-express.js-app          | b977c7407f328da929577745ad509639e26c428a |        0 |                 1 | TRUNCATED    | 1.02 / 0.69         |
| ryanmcmorrowsnyk/vulnerable-typescript-app     | 7f8b240a2f02beba099da3632d1ba679ff8bc32f |        9 |                 2 | TRUNCATED    | 0.26 / 0.14         |
| miguelgrinberg/microblog                       | a975ef64864354867c88e0ed3a17ba7d17dca752 |        0 |                 0 | COMPLETE     | 0.44 / 0.18         |
| pallets-eco/flask-security                     | 5d47d697d6f0806d0fe58559fe61cd6fd8ae16ef |        1 |                 1 | TRUNCATED    | 1.32 / 0.86         |
| encode/starlette                               | 03f12b7fcf0a3e21a8da648ca0900c79472e9efe |        0 |                 0 | TRUNCATED    | 0.93 / 0.52         |
| fastapi/full-stack-fastapi-template            | cb740b656d7a0a6c5e12c7bf8e50343ec94ee9c7 |        0 |                 1 | PARTIAL      | 2.43 / 1.60         |
| hagopj13/node-express-boilerplate              | 179ae84efec61b14206d0305d941daed6c6d07f9 |        0 |                 8 | PARTIAL      | 0.74 / 0.44         |
| sahat/hackathon-starter                        | 636440342a5b7b640d127dcde0c405c711c0ddaa |        6 |                31 | PARTIAL      | 3.17 / 2.33         |
| gothinkster/node-express-realworld-example-app | 30b68e1e881462b2f4164ea09ab4c4f5699c7b0b |        0 |                 0 | COMPLETE     | 1.22 / 0.86         |
| expressjs/session                              | 96ebea4b6cd805584fba04523773b1b918a836d7 |        0 |                 0 | COMPLETE     | 0.80 / 0.54         |
| fastify/fastify-secure-session                 | 06f4afb58d2a91e6350b71a6e491d4604333e6d4 |        0 |                 0 | COMPLETE     | 0.68 / 0.43         |
| strapi/strapi                                  | 34fdea8fb4e11afc475a0ffdc14311cce09ddded |        6 |                 3 | TRUNCATED    | 91.45 / 104.08      |

UNKNOWN counts sum independent engines plus finding proof and can refer to the same code. They are
not unique vulnerabilities. All 134 emitted observations have implementation-time review records; 0
remain unadjudicated. There is no independent human review or complete ground truth. Three false
insecure conclusions were found and corrected to retained UNKNOWN observations: Flask-Security
breach lookup (one) and placeholder key headers (two). Test-cookie settings and test keys are
explicitly distinguished from deployed vulnerabilities.

No supported-pattern FN was discovered within the listed selective source reviews. No corpus-wide
recall or accuracy is reported. CommonJS controller/factory composition, cross-file Python helpers,
unsupported scopes and resource-bounded omissions remain separate limitations. The external redirect
at vulnerable-typescript src/server.ts:239 establishes request.query -> alias -> res.redirect
without destination policy in the reviewed source.

13 repositories have TRUNCATED overall analysis. The Strapi parser and recursive identity issues,
and Juice Shop/Strapi processing costs, were discovered by unsuccessful exploratory runs retained as
development discoveries rather than discarded targets. Numeric AST/application bounds remain intact;
security identity propagation now explicitly enforces eight iterations/10000 facts and discards
incomplete trust. Corpus timing pairs are descriptive; controlled twenty-sample comparisons are
recorded separately in performance.json.

The full-report replay normalizes only documented UUID/time/root metadata. It compares findings,
proofs, uncertainty, limits and fingerprints, not merely counts. Raw source is not redistributed;
durable records include immutable source identities, source-file hashes for adjudications and
normalized report digests.
