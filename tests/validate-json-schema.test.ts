import { Client } from "pg";
import fs from "fs";
import { PostgreSqlContainer } from "testcontainers";
import { dirname } from "path";

const EXCLUDED_FILES = [
  "optional",
  "refRemote.json",
  "definitions.json",
  "zeroTerminatedFloats.json",
];
const EXCLUDED_SUITES = [
  [
    "patternProperties.json",
    "non-BMP, checks for proper surrogate pair handling for UTF-16",
  ],
  ["ecmascript-regex.json", "ECMA 262 regex non-compliance"],
  ["ecmascript-regex.json", "ECMA 262 \\d matches ascii digits only"],
  ["ecmascript-regex.json", "ECMA 262 \\w matches ascii letters only"],
  [
    "ecmascript-regex.json",
    "ECMA 262 \\w matches everything but ascii letters",
  ],
];
const EXCLUDED_TESTS = [
  ["ref.json", "escaped pointer ref", "percent invalid"],
  ["ref.json", "remote ref, containing refs itself", "remote ref invalid"],
  ["ref.json", "Recursive references between schemas", "valid tree"],
  ["ref.json", "refs with quote", "object with strings is invalid"],
  [
    "ref.json",
    "ref overrides any sibling keywords",
    "ref valid, maxItems ignored",
  ],
  [
    "ref.json",
    "Location-independent identifier with base URI change in subschema",
    "mismatch",
  ],
  ["ref.json", "Location-independent identifier with absolute URI", "mismatch"],
  ["ref.json", "Location-independent identifier", "mismatch"],
  ["ref.json", "Location-independent identifier", "match"],
];

const FUNCTIONS_PATH = `${__dirname}/../sql`;
const TEST_FILES_PATH = `${dirname(
  require.resolve("@json-schema-org/tests")
)}/../node_modules/json-schema-test-suite/tests/draft4`;

describe("validate_json_schema", () => {
  let db: Client;

  beforeAll(async () => {
    // Start to PG container
    const container = await new PostgreSqlContainer().start();

    // Create a PG Client
    db = new Client({
      host: container.getHost(),
      port: container.getPort(),
      database: container.getDatabase(),
      user: container.getUsername(),
      password: container.getPassword(),
    });

    // Connect to PG container
    await db.connect();

    // Get validate_json_schema from file
    const validateJsonSchemaDefinition = fs.readFileSync(
      `${FUNCTIONS_PATH}/validate_json_schema.sql`,
      "utf8"
    );

    // Add validate_json_schema function to DB
    await db.query(validateJsonSchemaDefinition);
  });

  afterAll(async () => {
    await db.end();
  });

  // Iterate schema validation files
  const files = fs
    .readdirSync(TEST_FILES_PATH)
    .filter((file) => !EXCLUDED_FILES.includes(file))
    .map((file) => ({ name: file, path: `${TEST_FILES_PATH}/${file}` }));

  const optionalFiles = fs
    .readdirSync(`${TEST_FILES_PATH}/optional`)
    .filter((file) => !EXCLUDED_FILES.includes(file))
    .map((file) => ({
      name: file,
      path: `${TEST_FILES_PATH}/optional/${file}`,
    }));

  const extraFiles = fs.readdirSync(`${__dirname}/extras`).map((file) => ({
    name: file,
    path: `${__dirname}/extras/${file}`,
  }));

  for (const file of [...files, ...optionalFiles, ...extraFiles]) {
    describe(file.name, () => {
      const suites = JSON.parse(fs.readFileSync(file.path, "utf8")).filter(
        (suite: any) => {
          return !EXCLUDED_SUITES.map((item) => JSON.stringify(item)).includes(
            JSON.stringify([file.name, suite.description])
          );
        }
      );

      for (const suite of suites) {
        describe(suite.description, () => {
          const { schema } = suite;

          const tests = suite.tests.filter((test: any) => {
            return !EXCLUDED_TESTS.map((item) => JSON.stringify(item)).includes(
              JSON.stringify([file.name, suite.description, test.description])
            );
          });

          for (const test of tests) {
            it(test.description, async () => {
              const { data, valid } = test;
              const { rows } = await db.query(
                "SELECT validate_json_schema($1, $2)",
                [JSON.stringify(schema), JSON.stringify(data)]
              );
              const result = rows[0].validate_json_schema;
              expect(result).toBe(valid);
            });
          }
        });
      }
    });
  }
});
