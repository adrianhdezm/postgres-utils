import { Client } from "pg";
import fs from "fs";
import { PostgreSqlContainer } from "testcontainers";
import { dirname } from "path";

const EXCLUDED_FILES = ["optional", "refRemote.json", "definitions.json"];
const EXCLUDED_TESTS = [
  // json-schema-org/JSON-Schema-Test-Suite#130
  ["ref.json", "escaped pointer ref", "percent invalid"],
  // json-schema-org/JSON-Schema-Test-Suite#114
  ["ref.json", "remote ref, containing refs itself", "remote ref invalid"],
];

const FUNCTIONS_PATH = `${__dirname}/../sql`;
const TEST_FILES_PATH = `${dirname(
  require.resolve("json-schema-test-suite")
)}/tests/draft4`;

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
    .filter((file) => !EXCLUDED_FILES.includes(file));

  for (const file of files) {
    describe(file, () => {
      const suites = JSON.parse(
        fs.readFileSync(`${TEST_FILES_PATH}/${file}`, "utf8")
      );

      for (const suite of suites) {
        describe(suite.description, () => {
          const { schema } = suite;

          const tests = suite.tests.filter((test: any) => {
            return !EXCLUDED_TESTS.map((item) => JSON.stringify(item)).includes(
              JSON.stringify([file, suite.description, test.description])
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
