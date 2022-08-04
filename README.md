## Useful Postgres Functions

### validate_json_schema.sql

`validate_json_schema()` can be used to validate the format of your JSON columns using [JSON schema](http://json-schema.org/) (supports the JSON schema draft v4 spec, except for remote http references). It is based on [postgres-json-schema](https://github.com/gavinwahl/postgres-json-schema).
